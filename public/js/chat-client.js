(function() {
  'use strict';

  // Elements
  const chatContainer = document.getElementById('chat-container');
  const messagesArea = document.getElementById('messages-area');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');

  // State
  let isLoading = false;

  // Welcome message (from server config or fallback)
  const WELCOME_MESSAGE = document.getElementById("welcome").textContent;

  // ============================================
  // MOBILE KEYBOARD HANDLING
  // ============================================

  function handleViewportResize() {
    if (!window.visualViewport) return;

    const viewport = window.visualViewport;
    const viewportHeight = viewport.height;
    const viewportOffsetTop = viewport.offsetTop;

    if (viewportOffsetTop > 0 || viewportHeight < window.innerHeight - 50) {
      chatContainer.style.position = 'fixed';
      chatContainer.style.top = viewportOffsetTop + 'px';
      chatContainer.style.height = viewportHeight + 'px';
      chatContainer.style.bottom = 'auto';
      setTimeout(scrollToBottom, 100);
    } else {
      chatContainer.style.position = 'absolute';
      chatContainer.style.top = '0';
      chatContainer.style.height = '';
      chatContainer.style.bottom = '0';
    }
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);
  }

  window.addEventListener('resize', function() {
    if (window.visualViewport) {
      handleViewportResize();
    } else {
      scrollToBottom();
    }
  });

  // ============================================
  // CHAT FUNCTIONALITY
  // ============================================

  function addMessage(role, text) {
    var row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: flex-end; gap: 8px; ' + (role === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;');

    if (role === 'assistant') {
      var avatar = document.createElement('img');
      avatar.src = '/desk.svg';
      avatar.alt = 'Civic Desk';
      avatar.style.cssText = 'width: 32px; height: 32px; border-radius: 9999px; object-fit: cover; flex-shrink: 0;';
      row.appendChild(avatar);
    }

    var bubble = document.createElement('div');
    bubble.style.cssText = 'max-width: 75%; padding: 10px 14px; font-size: 15px; line-height: 1.625; white-space: pre-wrap; word-break: break-word;';

    if (role === 'user') {
      bubble.style.cssText += 'background: #3b82f6; color: white; border-radius: 16px 16px 4px 16px;';
    } else {
      bubble.style.cssText += 'background: white; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 16px 16px 16px 4px;';
    }

    bubble.textContent = text;
    row.appendChild(bubble);
    messagesArea.appendChild(row);
    scrollToBottom();
  }

  function showTypingIndicator() {
    var indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.style.cssText = 'display: flex; align-items: flex-end; gap: 8px;';
    indicator.innerHTML = '<img src="/desk.svg" alt="Civic Desk" style="width: 32px; height: 32px; border-radius: 9999px; object-fit: cover;"><div style="padding: 10px 14px; border-radius: 16px 16px 16px 4px; background: white; border: 1px solid #e5e7eb; color: #9ca3af; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;">Typing...</div>';
    messagesArea.appendChild(indicator);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    var indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  async function sendMessage() {
    var text = messageInput.value.trim();
    if (!text || isLoading) return;

    isLoading = true;
    messageInput.value = '';
    updateSendButton();
    addMessage('user', text);
    showTypingIndicator();

    try {
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      var data = await response.json();
      hideTypingIndicator();

      if (data.response) {
        addMessage('assistant', data.response);
      } else if (data.error) {
        addMessage('assistant', data.error);
        console.error('API error:', data.error);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      hideTypingIndicator();
      addMessage('assistant', 'Sorry, something went wrong. Please try again.');
    } finally {
      isLoading = false;
      updateSendButton();
    }
  }

  function updateSendButton() {
    var hasText = messageInput.value.trim().length > 0;
    var isEnabled = hasText && !isLoading;

    if (isEnabled) {
      sendButton.disabled = false;
      sendButton.style.background = '#3b82f6';
      sendButton.style.cursor = 'pointer';
    } else {
      sendButton.disabled = true;
      sendButton.style.background = '#d1d5db';
      sendButton.style.cursor = 'default';
    }
  }

  // Event listeners
  messageInput.addEventListener('input', updateSendButton);

  messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendButton.addEventListener('click', sendMessage);

  messageInput.addEventListener('input', function() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  });

  messageInput.addEventListener('focus', function() {
    setTimeout(function() {
      scrollToBottom();
      messageInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 300);
  });

  // ============================================
  // INITIALIZATION
  // ============================================

  async function initChat() {
    chatContainer.style.display = 'flex';
    addMessage('assistant', WELCOME_MESSAGE);
    messageInput.disabled = true;
    try {
      const response = await fetch('/api/history', {cache: 'no-store'});
      if (!response.ok) throw new Error();
      for (const item of await response.json()) addMessage(item.role, item.content);
    } catch {
      addMessage('assistant', 'Your earlier messages could not be loaded.');
    } finally {
      messageInput.disabled = false;
    }
  }

  initChat();

})();
