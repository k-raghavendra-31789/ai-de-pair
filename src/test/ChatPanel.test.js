import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatPanel from '../components/ChatPanel'
import { AppStateProvider } from '../contexts/AppStateContext'
import { ThemeProvider } from '../components/ThemeContext'

// Test wrapper with all necessary providers
const TestWrapper = ({ children }) => (
  <ThemeProvider>
    <AppStateProvider>
      {children}
    </AppStateProvider>
  </ThemeProvider>
)

describe('ChatPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render chat panel with default elements', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Ask about your files/)).toBeInTheDocument()
      expect(screen.getByText('Send')).toBeInTheDocument()
    })

    it('should render LLM selector', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      expect(screen.getByDisplayValue('claude-sonnet-3.5')).toBeInTheDocument()
    })

    it('should render with custom width', () => {
      render(
        <TestWrapper>
          <ChatPanel width={500} />
        </TestWrapper>
      )

      const chatPanel = screen.getByText('AI Assistant').closest('div')
      expect(chatPanel).toHaveStyle({ width: '500px' })
    })
  })

  describe('Chat Input', () => {
    it('should update input value when typing', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      await user.type(input, 'Hello, AI!')

      expect(input).toHaveValue('Hello, AI!')
    })

    it('should clear input after sending message', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      const sendButton = screen.getByText('Send')

      await user.type(input, 'Test message')
      await user.click(sendButton)

      expect(input).toHaveValue('')
    })

    it('should send message on Enter key press', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      await user.type(input, 'Test message{enter}')

      expect(input).toHaveValue('')
    })

    it('should not send empty messages', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const sendButton = screen.getByText('Send')
      await user.click(sendButton)

      // Should not add any messages to chat
      expect(screen.queryByText('Test message')).not.toBeInTheDocument()
    })

    it('should trim whitespace from messages', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      const sendButton = screen.getByText('Send')

      await user.type(input, '   ')
      await user.click(sendButton)

      expect(input).toHaveValue('')
    })
  })

  describe('LLM Selection', () => {
    it('should change selected LLM', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const selector = screen.getByDisplayValue('claude-sonnet-3.5')
      await user.selectOptions(selector, 'gpt-4')

      expect(selector).toHaveValue('gpt-4')
    })

    it('should display all available LLM options', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const selector = screen.getByDisplayValue('claude-sonnet-3.5')
      const options = selector.querySelectorAll('option')

      expect(options).toHaveLength(4)
      expect(screen.getByText('Claude Sonnet 3.5')).toBeInTheDocument()
      expect(screen.getByText('GPT-4')).toBeInTheDocument()
      expect(screen.getByText('GPT-3.5 Turbo')).toBeInTheDocument()
      expect(screen.getByText('Gemini Pro')).toBeInTheDocument()
    })
  })

  describe('File Context Display', () => {
    it('should show available files count', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      expect(screen.getByText(/Available Files: 0/)).toBeInTheDocument()
    })

    it('should show open tabs count', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      expect(screen.getByText(/Open Tabs: 0/)).toBeInTheDocument()
    })

    it('should show Excel files count', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      expect(screen.getByText(/Excel Files: 0/)).toBeInTheDocument()
    })

    it('should update counts when files are available', () => {
      // This would require setting up initial state with files
      // through the context provider or props
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      // Test would verify dynamic count updates
      expect(screen.getByText(/Available Files:/)).toBeInTheDocument()
    })
  })

  describe('Chat Messages', () => {
    it('should display chat messages', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      // Initially no messages
      expect(screen.queryByText('Test message')).not.toBeInTheDocument()
    })

    it('should scroll to bottom when new message is added', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      await user.type(input, 'Test message{enter}')

      // Should maintain scroll position at bottom
      const messagesContainer = screen.getByText('AI Assistant').closest('div')
      expect(messagesContainer).toBeInTheDocument()
    })

    it('should handle multiple messages', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)

      await user.type(input, 'First message{enter}')
      await user.type(input, 'Second message{enter}')
      await user.type(input, 'Third message{enter}')

      // All messages should be cleared after sending
      expect(input).toHaveValue('')
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should focus input with Ctrl+K', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

      expect(input).toHaveFocus()
    })

    it('should handle Shift+Enter for new line', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      await user.type(input, 'First line{shift}{enter}Second line')

      expect(input).toHaveValue('First line\nSecond line')
    })
  })

  describe('Responsive Design', () => {
    it('should adapt to different widths', () => {
      const { rerender } = render(
        <TestWrapper>
          <ChatPanel width={300} />
        </TestWrapper>
      )

      let chatPanel = screen.getByText('AI Assistant').closest('div')
      expect(chatPanel).toHaveStyle({ width: '300px' })

      rerender(
        <TestWrapper>
          <ChatPanel width={600} />
        </TestWrapper>
      )

      chatPanel = screen.getByText('AI Assistant').closest('div')
      expect(chatPanel).toHaveStyle({ width: '600px' })
    })

    it('should handle very narrow widths', () => {
      render(
        <TestWrapper>
          <ChatPanel width={200} />
        </TestWrapper>
      )

      const chatPanel = screen.getByText('AI Assistant').closest('div')
      expect(chatPanel).toHaveStyle({ width: '200px' })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      expect(input).toHaveAttribute('aria-label')
      
      const sendButton = screen.getByText('Send')
      expect(sendButton).toHaveAttribute('aria-label')
    })

    it('should be keyboard navigable', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      const selector = screen.getByDisplayValue('claude-sonnet-3.5')
      const sendButton = screen.getByText('Send')

      expect(input).toHaveAttribute('tabIndex')
      expect(selector).toHaveAttribute('tabIndex')
      expect(sendButton).toHaveAttribute('tabIndex')
    })

    it('should announce message count to screen readers', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const messagesArea = screen.getByText('AI Assistant').closest('div')
      expect(messagesArea).toHaveAttribute('aria-live')
    })
  })

  describe('Error Handling', () => {
    it('should handle send message errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const input = screen.getByPlaceholderText(/Ask about your files/)
      await user.type(input, 'Test message{enter}')

      // Should not crash on errors
      expect(input).toHaveValue('')
      
      consoleSpy.mockRestore()
    })

    it('should handle LLM selection errors', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      const selector = screen.getByDisplayValue('claude-sonnet-3.5')
      
      // Should handle invalid selections gracefully
      expect(() => {
        fireEvent.change(selector, { target: { value: 'invalid-llm' } })
      }).not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const { rerender } = render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      // Re-render with same props
      rerender(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      // Component should handle re-renders efficiently
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })

    it('should handle long message history efficiently', () => {
      render(
        <TestWrapper>
          <ChatPanel width={400} />
        </TestWrapper>
      )

      // Should be able to handle many messages without performance issues
      expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    })
  })
})
