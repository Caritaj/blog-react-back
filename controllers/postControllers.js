const Post = require('../models/postModel')
const HttpError = require('../models/errorModel');
const User = require('../models/userModel');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

/* 
    Create a new post
    Method: POST
    Route: api/posts
    Protected: Yes
*/
const createPost = async (req, res, next) => {
    try {
        const { title, category, description } = req.body;
        if (!title || !category || !description || !req.files) {
            return next(new HttpError('Fill in all fields and choose thumbnail', 422));
        }
        const { thumbnail } = req.files;
        //check the file size
        if (thumbnail.size > 2000000) {
            return next(new HttpError('Thumbnail too big. Should be less than 2MB', 422));
        }
        let fileName = thumbnail.name;
        let splittedFilename = fileName.split('.');
        let newFilename = splittedFilename[0] + uuid() + '.' + splittedFilename[splittedFilename.length - 1];
        thumbnail.mv(path.join(__dirname, '..', 'uploads', newFilename), async (err) => {
            if (err) {
                return next(err);
            } else {
                const newPost = await Post.create({ title, category, description, thumbnail: newFilename, creator: req.user.id });
                if (!newPost) {
                    return next(new HttpError('Post could not be created', 422));
                }
                //find user and increase post count by 1
                const currentUser = await User.findById(req.user.id);
                const userPostCount = currentUser.posts + 1;
                await User.findByIdAndUpdate(req.user.id, { posts: userPostCount });

                res.status(200).json(newPost);
            }
        });

    } catch (error) {
        return next(new HttpError(error));
    }
}

/* 
    Get single post
    Method: GET
    Route: api/posts
    Protected: No
*/
const getPosts = async (req, res, next) => {
    try {
        const posts = await Post.find().sort({ updateAt: -1 })
        res.status(200).json(posts)
    } catch (error) {
        return next(new HttpError(error));
    }
}
/* 
    Get single post
    Method: GET
    Route: api/posts/:id
    Protected: No
*/
const getPost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);
        if (!post) {
            return next(new HttpError('Post not found', 404));
        }
        res.status(200).json(post);
    } catch (error) {
        return next(new HttpError(error));
    }
}
/* 
    Get post by category
    Method: GET
    Route: api/posts/categories/:category
    Protected: Yes
*/
const getCatPosts = async (req, res, next) => {
    try {
        const { category } = req.params;
        const castPost = await Post.find({ category }).sort({ createdAt: -1 });
        res.status(200).json(castPost)
    } catch (error) {
        return next(new HttpError(error));
    }
}
/* 
    Get user/author post
    Method: GET
    Route: api/posts/users/:id
    Protected: No
*/
const getUserPosts = async (req, res, next) => {
    try {
        const { id } = req.params;
        const posts = await Post.find({ creator: id }).sort({ createdAt: -1 })
        res.status(200).json(posts);
    } catch (error) {
        return next(new HttpError(error));
    }
}
/* 
    Edit post
    Method: PATCH
    Route: api/posts/:id
    Protected: yes
*/
const editPost = async (req, res, next) => {
    try {
        let fileName;
        let newFilename;
        let updatedPost;
        const postId = req.params.id;
        let { title, category, description } = req.body;

        //ReactQuill has a paragraph opening and closing tag with a break tag in between so there are 11 characters in there already
        if (!title || !category || description.length < 12) {
            return next(new HttpError('Fill in all fields', 422));
        }
        //get old post from db
        const oldPost = await Post.findById(postId);
        if (req.user.id == oldPost.creator.toString()) {
            if (!req.files) {
                updatedPost = await Post.findByIdAndUpdate(postId, { title, category, description }, { new: true })
            } else {
                //delete old thumbnail from upload
                fs.unlink(path.join(__dirname, '..', 'uploads', oldPost.thumbnail), async (err) => {
                    if (err) {
                        return next(new HttpError(err));
                    }
                });
                //upload new thumbnail
                const { thumbnail } = req.files;
                //check file size
                if (thumbnail.size > 2000000) {
                    return next(new HttpError('Thumbnail too big. Should be less than 2MB', 422));
                }
                fileName = thumbnail.name;
                let splittedFilename = fileName.split('.');
                newFilename = splittedFilename[0] + uuid() + '.' + splittedFilename[splittedFilename.length - 1];
                thumbnail.mv(path.join(__dirname, '..', 'uploads', newFilename), async (err) => {
                    if (err) {
                        return next(new HttpError(err));
                    }
                })

                updatedPost = await Post.findByIdAndUpdate(postId, { title, category, description, thumbnail: newFilename }, { new: true });
            }
        }

        if (!updatedPost) {
            return next(new HttpError('Post could not be edited', 422));
        }
        res.status(200).json(updatedPost);

    } catch (error) {
        return next(new HttpError(error));
    }
}
/* 
    Create a new post
    Method: DELETE
    Route: api/posts/:id
    Protected: yes
*/
const deletePost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        if (!postId) {
            return next(new HttpError('Post unavailable', 404));
        }

        const post = await Post.findById(postId);
        const fileName = post?.thumbnail;
        if (req.user.id == post.creator.toString()) {
            //delete thumbnail from upload folder
            fs.unlink(path.join(__dirname, '..', 'uploads', fileName), async (err) => {
                if (err) {
                    return next(new HttpError(err));
                } else {
                    await Post.findByIdAndDelete(postId);
                    //find user and reduce post count by 1
                    const currentUser = await User.findById(req.user.id);
                    const userPostCount = currentUser?.posts - 1;
                    await User.findByIdAndUpdate(req.user.id, { posts: userPostCount });
                    res.json({ message: 'Post deleted successfully' });
                }
            });
        } else {
            return next(new HttpError('Post could not be deleted', 403));
        }


    } catch (error) {
        return next(new HttpError(error));
    }
}

module.exports = {
    createPost, getPost, getPosts, getCatPosts, editPost, deletePost, getUserPosts,
}