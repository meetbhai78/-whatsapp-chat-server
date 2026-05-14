const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    message: { type: String },
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    imageUrl: { type: String },
    timestamp: { type: Number, default: Date.now },
    feeling: { type: Number, default: -1 } // -1 means no reaction
});

module.exports = mongoose.model('Message', messageSchema);
