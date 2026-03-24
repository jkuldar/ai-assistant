export class ChatView {
  constructor(container, api) {
    this.container = container;
    this.api = api;
    this.conversationHistory = [];
    this.isLoading = false;
    this.restoreHistory();
  }

  restoreHistory() {
    try {
      const saved = sessionStorage.getItem('chat_history');
      if (saved) {
        this.conversationHistory = JSON.parse(saved);
      }
    } catch { /* ignore corrupt data */ }
  }

  saveHistory() {
    try {
      sessionStorage.setItem('chat_history', JSON.stringify(this.conversationHistory));
    } catch { /* ignore quota errors */ }
  }

  async load() {
    this.render();
    this.renderRestoredHistory();
    this.attachListeners();
  }

  renderRestoredHistory() {
    if (this.conversationHistory.length === 0) return;
    for (const msg of this.conversationHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        this.appendMessage(msg.role, msg.content);
      }
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="chat-view">
        <div class="chat-header">
          <h2>Wellness Assistant</h2>
          <p class="chat-subtitle">Ask about your health data, nutrition, meal plans, or get wellness advice.</p>
        </div>
        <div class="chat-messages" id="chat-messages">
          <div class="chat-message assistant">
            <div class="chat-bubble">Hi! I'm your wellness assistant. I can help you understand your health metrics, review your nutrition, discuss meal plans, or answer general wellness questions. What would you like to know?</div>
          </div>
        </div>
        <form class="chat-input-form" id="chat-form">
          <input
            type="text"
            id="chat-input"
            class="chat-input"
            placeholder="Type your message..."
            autocomplete="off"
            maxlength="1000"
          />
          <button type="submit" class="btn-primary chat-send-btn" id="chat-send-btn">Send</button>
        </form>
      </div>
    `;
  }

  attachListeners() {
    const form = this.container.querySelector('#chat-form');
    const input = this.container.querySelector('#chat-input');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || this.isLoading) return;
      input.value = '';
      this.sendMessage(text);
    });
  }

  async sendMessage(text) {
    this.isLoading = true;
    this.appendMessage('user', text);
    this.showTypingIndicator();
    this.updateSendButton(true);

    try {
      const data = await this.api.sendChatMessage(text, this.conversationHistory);
      this.removeTypingIndicator();

      if (data.success) {
        this.conversationHistory = data.conversationHistory || [];
        this.saveHistory();
        this.appendMessage('assistant', data.reply);
      } else {
        this.appendMessage('assistant', data.message || 'Sorry, something went wrong. Please try again.');
      }
    } catch (err) {
      this.removeTypingIndicator();
      this.appendMessage('assistant', 'Unable to reach the assistant. Please check your connection and try again.');
    } finally {
      this.isLoading = false;
      this.updateSendButton(false);
      this.container.querySelector('#chat-input')?.focus();
    }
  }

  appendMessage(role, text) {
    const messagesEl = this.container.querySelector('#chat-messages');
    if (!messagesEl) return;

    const msg = document.createElement('div');
    msg.className = `chat-message ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;

    msg.appendChild(bubble);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  showTypingIndicator() {
    const messagesEl = this.container.querySelector('#chat-messages');
    if (!messagesEl) return;

    const indicator = document.createElement('div');
    indicator.className = 'chat-message assistant';
    indicator.id = 'chat-typing';
    indicator.innerHTML = '<div class="chat-bubble typing-indicator"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(indicator);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  removeTypingIndicator() {
    const el = this.container.querySelector('#chat-typing');
    if (el) el.remove();
  }

  updateSendButton(loading) {
    const btn = this.container.querySelector('#chat-send-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? '...' : 'Send';
  }
}
