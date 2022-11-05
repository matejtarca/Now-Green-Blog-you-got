const markdown = require('markdown-wasm');
const fs = require("fs");
const db = require('better-sqlite3')('src/backend/db/db', { readonly: true });
const pathlib = require('path').posix;

const handlePostList = (req, res) => {
    res.statusCode = 200;
    res.end('<html><body><h1>Post list</h1></body></html>');
}

const ROOT = pathlib.resolve(".") + "/";

const handlePublic = async (req, res) => {
    const path = pathlib.resolve(pathlib.join(ROOT, req.url));

    if (!path.startsWith(ROOT)) {
        res.statusCode = 403;
        return res.end('Access denied');
    }

    try {
        var stat = await fs.promises.stat(path);
    } catch (e) {
        res.statusCode = 404;
        console.log(e)
        return res.end("File not found");
    }

    if (stat.isDirectory()) {
        res.statusCode = 403;
        return res.end("Directory access is forbidden");
    }

    if (req.url.endsWith(".css")) {
        res.setHeader('Content-Type', 'text/css');
    }

    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(path);
    stream.pipe(res);
}

const handleCreatePost = async (req, res) => {
    const path = pathlib.resolve(pathlib.join(ROOT, 'src/frontend/create-post-minified.html'));

    res.setHeader('Content-Type', 'text/html');

    const stream = fs.createReadStream(path);
    stream.pipe(res);
}

const postProcessHtml = (html, postID, username) => {
    const getMedia = db.prepare('SELECT filename, code FROM medias WHERE post_id = ?');
    const medias = getMedia.all(postID);
    medias.forEach(media => {
        // Parse images
        html = html.replace(`<img src="${media.code}" alt="image">`, `
    <picture>
    <source srcset="/dist/media/${username}/${postID}/480p_${media.filename}.webp"
            media="(min-width: 600px)">
     <source srcset="/dist/media/${username}/${postID}/480p_${media.filename}.webp"
            media="(min-width: 300px)">
    <img src="/dist/media/${username}/${postID}/240p_${media.filename}.webp" alt="">
</picture>
        `);

        // Parse videos
        html = html.replace(`<img src="${media.code}" alt="video">`, `
<video controls width="800" style="display: block" preload="none">
    <source src="/dist/media/${username}/${postID}/480p_${media.filename.split(".").slice(0, -1).join(".")}.mp4">
</video>`);
    })
    return html
}

module.exports = async function handle_get(req, res){
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/') {
        return handlePostList(req, res);
    }
    console.log(req.url)

    if (req.url.startsWith("/posts/")) {
        const splitted = req.url.split("/");
        console.log(splitted);
        if (splitted.length !== 4) {
            res.statusCode = 400;
            return res.end('<html><body><h1>Bad request</h1></body></html>');
        }

        const username = splitted[2];
        const postID = splitted[3];
        const getPost = db.prepare('SELECT title, content, ready FROM posts WHERE user = ? AND id = ?');
        const post = getPost.get(username, postID);
        console.log(username, postID, post);
        if (!post) {
            res.statusCode = 400;
            return res.end('<html><body><h1>Post not found</h1></body></html>');
        }
        if (post.ready === 0) {
            res.statusCode = 202;
            return res.end(`
<!DOCTYPE html>
    <html lang="en">
        <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta charset="UTF-8">
        <title>${post.title}</title>
    <link rel="stylesheet" href="/dist/styles/main.css">
    <style>
    .content {
        width: 100%;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
    </head>
    <body>
    <div class="content">
        <h1>Post is not <span style="color: #FCAC00;">Green</span> enough yet ...</h1>
    </div>
    </body>
</html>`
)}
        res.statusCode = 200;
        const content_html = markdown.parse(post.content);
        return res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${post.title}</title>
    <link rel="stylesheet" href="/dist/styles/main.css">
    <style>
    .content-main {
        padding: 15px;
    }
    .content {
    margin-top: 15px;
    }
</style>
</head>
<body>
<div class="content-main">
<h1>${post.title}</h1>
<div class="content">${postProcessHtml(content_html, postID, username)}</div>
</div>
</body>
</html>
`);
    }

    if (req.url.startsWith("/create-post")) {
        return handleCreatePost(req, res);
    }

    if (req.url.startsWith("/dist/")) {
        return handlePublic(req, res);
    }

    res.statusCode = 404;
    res.end('<html><body><h1>Not found</h1></body></html>');
};
