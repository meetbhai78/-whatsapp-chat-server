const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true }, // We will use phone number as UID for simplicity
    name: { type: String, default: "No Name" },
    phoneNumber: { type: String, required: true, unique: true },
    profileImage: { type: String, default: "No Image" }
});

module.exports = mongoose.model('User', userSchema);
