import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  channelType: {
    type: String,
    enum: ['web', 'whatsapp', 'widget', 'telegram'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  topic: {
    type: String,
    default: null
  },
  summary: {
    type: String,
    default: null
  },
  messageCount: {
    type: Number,
    default: 0
  },
  lastMessageAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Index for finding active conversations by user
conversationSchema.index({ userId: 1, status: 1 });

// Index for sorting by most recent activity
conversationSchema.index({ lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
