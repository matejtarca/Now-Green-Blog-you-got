const db = require('better-sqlite3')('src/backend/db/db', { readonly: true });

const handlePostList = (req, res) => {
    res.statusCode = 200;
    res.end('<html><body><h1>Post list</h1></body></html>');
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
        const getPost = db.prepare('SELECT title, content FROM posts WHERE user = ? AND id = ?');
        const post = getPost.get(username, postID);
        if (!post) {
            res.statusCode = 400;
            return res.end('<html><body><h1>Post not found</h1></body></html>');
        }
        res.statusCode = 200;
        return res.end(`<html><body><h1>${post.title}</h1><p>${post.content}</p></body></html>`);
    }
    res.statusCode = 404;
    res.end('<html><body><h1>Not found</h1></body></html>');
};
