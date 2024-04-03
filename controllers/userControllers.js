const User = require('../models/userModel')
const HttpError = require('../models/errorModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken')
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');


/* 
    Register a new user
    Method: POST
    Route: api/users/register
    Protected: No
*/
const registerUser = async (req, res, next) => {
    try {
        const { name, email, password, password2 } = req.body;
        if (!name || !email || !password || !password2) {
            return next(new HttpError('Fill in all fields', 422));
        }

        const newEmail = email.toLowerCase();
        const emailExists = await User.findOne({ email: newEmail })

        if (emailExists) {
            return next(new HttpError('Email already exits', 422));
        }

        if (password.length < 6) {
            return next(new HttpError('Password should be at least 6 characters', 422));
        }

        if (password !== password2) {
            return next(new HttpError('Passwords do not match', 422));
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPass = await bcrypt.hash(password, salt);
        const newUser = await User.create({ name, email: newEmail, password: hashedPass })
        res.status(201).json(`New User ${newUser.email} registered`)

    } catch (error) {
        return next(new HttpError('User registration failed', 422));
    }
}
/* 
    Login a new user
    Method: POST
    Route: api/users/login
    Protected: No
*/
const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return next(new HttpError('Fill in all fields', 422));
        }

        const newEmail = email.toLowerCase();
        const user = await User.findOne({ email: newEmail })
        const comparePass = await bcrypt.compare(password, user.password);
        if (!comparePass) {
            return next(new HttpError('Invalid credentials', 422));
        }

        if (!user) {
            return next(new HttpError('Invalid credentials', 422));
        }

        const { _id: id, name } = user;
        const token = jwt.sign({ id, name }, process.env.JWT_SECRET, { expiresIn: '1h' })
        res.status(200).json({ token, id, name })

    } catch (error) {
        return next(new HttpError('Login registration failed', 422));
    }
}
/* 
    Get user profile
    Method: POST
    Route: api/users/:id
    Protected: Yes
*/
const getUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-password');
        if (!user) {
            return next(new HttpError('User not found', 404));
        }
        res.status(200).json(user)
    } catch (error) {
        return next(new HttpError(error));
    }
}
/* 
    Change user avatar(profile picture)
    Method: POST
    Route: api/users/change-avatar
    Protected: Yes
*/
const changeAvatar = async (req, res, next) => {
    try {
        if (!req.files.avatar) {
            return next(new HttpError('No avatar selected', 422));
        }

        //find user from database
        const user = await User.findById(req.user.id);
        //delete old avatar if exists
        if (user.avatar) {
            fs.unlink(path.join(__dirname, '..', 'uploads', user.avatar), (err) => {
                if (err) {
                    return next(new HttpError(err));
                }
            })
        }

        const { avatar } = req.files;
        //check file size
        if (avatar.size > 500000) {
            return next(new HttpError('Profile picture too big. Should be less than 500kb', 422));
        }

        let fileName;
        fileName = avatar.name;
        let splittedFilename = fileName.split('.');
        let newFilename = splittedFilename[0] + uuid() + '.' + splittedFilename[splittedFilename.length - 1];
        avatar.mv(path.join(__dirname, '..', 'uploads', newFilename), async (err) => {
            if (err) {
                return next(new HttpError(err));
            }
        })

        const updatedAvatar = await User.findByIdAndUpdate(req.user.id, { avatar: newFilename }, { new: true });
        if (!updatedAvatar) {
            return next(new HttpError('Avatar could not be changed', 422));
        }
        res.status(200).json(updatedAvatar)

    } catch (error) {
        return next(new HttpError(error));
    }
}
/* 
    Edit user details(from profile)
    Method: PUT
    Route: api/users/edit-user
    Protected: Yes
*/
const editUser = async (req, res, next) => {
    try {
        const { name, email, currentPassword, newPassword, newConfirmPassword } = req.body;
        if (!name || !email || !currentPassword || !newPassword || !newConfirmPassword) {
            return next(new HttpError('Fill in all fields', 422));
        }
        //get user  from database
        const user = await User.findById(req.user.id);
        if (!user) {
            return next(new HttpError('User not found', 404));
        }
        //make sure new email does not already exist
        const emailExists = await User.findOne({ email });
        //we want to update other details with/without changing the email(witch is a unique id because we use it to login)
        if (emailExists && (emailExists._id != req.user.id)) {
            return next(new HttpError('Email already exits', 422));
        }
        //compare current password to db password
        const validateUserPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validateUserPassword) {
            return next(new HttpError('Invalid current password', 422));
        }

        //compare new passwords
        if (newPassword !== newConfirmPassword) {
            return next(new HttpError('New passwords do not match', 422));
        }

        //has new password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        //update user info in db
        const newInfo = await User.findByIdAndUpdate(req.user.id, { name, email, password: hash }, { new: true })
        res.status(200).json(newInfo);

    } catch (error) {
        return next(new HttpError(error));
    }
}
/* 
    Get authors
    Method: GET
    Route: api/users/authors
    Protected: No
*/
const getAuthors = async (req, res, next) => {
    try {
        const authors = await User.find().select('-password');
        res.json(authors)
    } catch (error) {
        return next(new HttpError(error));
    }
}

module.exports = {
    registerUser, loginUser, getUser, changeAvatar, editUser, getAuthors
}