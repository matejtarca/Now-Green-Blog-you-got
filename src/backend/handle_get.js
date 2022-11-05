const markdown = require('markdown-wasm');
const fs = require("fs");
const db = require('better-sqlite3')('src/backend/db/db', { readonly: true });

const handlePostList = (req, res) => {
    res.statusCode = 200;
    res.end('<html><body><h1>Post list</h1></body></html>');
}

const handlePublic = (req, res) => {
    res.statusCode = 200

    fs.readFile(`src/${req.url}`, "utf8", function(err, data){
        if (err) {
            res.statusCode = 500;
            res.end(err.message);
        } else {
            res.writeHead(200, {'Content-Type': 'text/css'});
            res.end(data);
        }
    });
}

const postProcessHtml = (html, postID, username) => {
    const getMedia = db.prepare('SELECT filename, code FROM medias WHERE post_id = ?');
    const medias = getMedia.all(postID);
    medias.forEach(media => {
        // Parse images
        html = html.replace(`<img src="${media.code}" alt="image">`, `
    <picture>
    <source srcset="/public/${username}/${postID}/${media.filename}"
            media="(min-width: 800px)">
    <img src="/public/${username}/${postID}/${media.filename}" alt="">
</picture>
        `);

        // Parse videos
        html = html.replace(`<img src="${media.code}" alt="video">`, `
<video controls width="250" style="display: block" preload="none">
    <source src="/public/${username}/${postID}/${media.filename}">
</video>`);
    })
    return html
}

module.exports = async function handle_get(req, res){
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/') {
        return handlePostList(req, res);
    }

    if (req.url.startsWith("/posts/")) {
        const splitted = req.url.split("/");
        if (splitted.length !== 4) {
            res.statusCode = 400;
            return res.end('<html><body><h1>Bad request</h1></body></html>');
        }

        const username = splitted[2];
        const postID = splitted[3];
        const getPost = db.prepare('SELECT title, content, ready FROM posts WHERE user = ? AND id = ?');
        const post = getPost.get(username, postID);
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
        <meta charset="UTF-8">
        <title>${post.title}</title>
    <link rel="stylesheet" href="/public/styles/main.css">
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
    <title>${post.title}</title>
    <link rel="stylesheet" href="/public/styles/main.css">
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

    if (req.url.startsWith("/public/")) {
        return handlePublic(req, res);
    }

    res.statusCode = 404;
    res.end('<html><body><h1>Not found</h1></body></html>');
};
