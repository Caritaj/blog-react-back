const { Router } = require('express');
const { registerUser, loginUser, getUser, changeAvatar, editUser, getAuthors } = require('../controllers/userControllers')


const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/:id', getUser);
router.put('/change-avatar', changeAvatar);
router.put('/edit-user', editUser);
router.get('/', getAuthors);

module.exports = router;