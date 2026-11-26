import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  channelType: {
    type: String,
    enum: ['web', 'whatsapp', 'widget', 'telegram'],
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Primary index: load conversation messages in chronological order
messageSchema.index({ conversationId: 1, createdAt: 1 });

// Research index: find all bot responses
messageSchema.index({ role: 1, createdAt: -1 });

// Text index for full-text search across messages
messageSchema.index({ content: 'text' });

export const Message = mongoose.model('Message', messageSchema);
