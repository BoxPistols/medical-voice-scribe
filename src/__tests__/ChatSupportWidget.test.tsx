import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ChatSupportWidget from '@/app/components/ChatSupportWidget';
import { mockSoapNote } from './fixtures/soapNote';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
});

// Mock URL.createObjectURL/revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:test');
global.URL.revokeObjectURL = vi.fn();

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

const defaultProps = {
  soapNote: null,
  transcript: '',
  selectedModel: 'gpt-4.1-mini' as const,
  isRecording: false,
  isAnalyzing: false,
};

describe('ChatSupportWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Widget open/close', () => {
    it('should render floating button', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      const button = screen.getByLabelText('チャットサポートを開く');
      expect(button).toBeInTheDocument();
    });

    it('should open widget when FAB is clicked', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      const button = screen.getByLabelText('チャットサポートを開く');
      fireEvent.click(button);
      expect(screen.getByText('診療サポート')).toBeInTheDocument();
    });

    it('should close widget when FAB is clicked again', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      const button = screen.getByLabelText('チャットサポートを開く');

      // Open
      fireEvent.click(button);
      expect(screen.getByText('診療サポート')).toBeInTheDocument();

      // Close
      fireEvent.click(button);
      expect(screen.queryByText('診療サポート')).not.toBeInTheDocument();
    });
  });

  describe('Tabs', () => {
    it('should show recommendations tab by default', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      // Default tab should be recommendations
      const recTab = screen.getByRole('tab', { name: /推奨/i });
      expect(recTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch to chat tab', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      const chatTab = screen.getByRole('tab', { name: /チャット/i });
      fireEvent.click(chatTab);

      // Chat tab should show input area
      expect(screen.getByPlaceholderText('質問を入力...')).toBeInTheDocument();
    });

    it('should switch to help tab', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      const helpTab = screen.getByRole('tab', { name: /ヘルプ/i });
      fireEvent.click(helpTab);

      // Help tab should show categories
      expect(screen.getByText('録音')).toBeInTheDocument();
      expect(screen.getByText('分析')).toBeInTheDocument();
    });
  });

  describe('Recommendations', () => {
    it('should show recommendation badge when SOAP note present', () => {
      render(<ChatSupportWidget {...defaultProps} soapNote={mockSoapNote} />);
      // Badge should show number of recommendations
      const badge = document.querySelector('.chat-support-badge');
      expect(badge).toBeInTheDocument();
    });

    it('should show no badge when no SOAP note', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      const badge = document.querySelector('.chat-support-badge');
      expect(badge).not.toBeInTheDocument();
    });

    it('should display recommendation cards when opened with SOAP note', () => {
      render(<ChatSupportWidget {...defaultProps} soapNote={mockSoapNote} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      // Should show recommendation items
      expect(screen.getByText('鑑別診断の確認')).toBeInTheDocument();
    });
  });

  describe('Chat messaging', () => {
    it('should send message and show it in chat', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ response: 'AIの回答です', type: 'normal' }),
      });

      render(<ChatSupportWidget {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      // Switch to chat tab
      const chatTab = screen.getByRole('tab', { name: /チャット/i });
      fireEvent.click(chatTab);

      // Type message
      const input = screen.getByPlaceholderText('質問を入力...');
      fireEvent.change(input, { target: { value: 'テスト質問' } });

      // Send via Cmd+Enter
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

      // User message should appear
      await waitFor(() => {
        expect(screen.getByText('テスト質問')).toBeInTheDocument();
      });

      // AI response should appear
      await waitFor(() => {
        expect(screen.getByText('AIの回答です')).toBeInTheDocument();
      });
    });

    it('should show error message on API failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<ChatSupportWidget {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      const chatTab = screen.getByRole('tab', { name: /チャット/i });
      fireEvent.click(chatTab);

      const input = screen.getByPlaceholderText('質問を入力...');
      fireEvent.change(input, { target: { value: 'テスト' } });
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

      await waitFor(() => {
        expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
      });
    });

    it('should not send empty message', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      const chatTab = screen.getByRole('tab', { name: /チャット/i });
      fireEvent.click(chatTab);

      const input = screen.getByPlaceholderText('質問を入力...');
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Recording status', () => {
    it('should show recording indicator when isRecording is true', () => {
      render(<ChatSupportWidget {...defaultProps} isRecording={true} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      expect(screen.getByText('録音中')).toBeInTheDocument();
    });

    it('should show analyzing indicator when isAnalyzing is true', () => {
      render(<ChatSupportWidget {...defaultProps} isAnalyzing={true} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      expect(screen.getByText('分析中')).toBeInTheDocument();
    });
  });

  describe('Help tab', () => {
    it('should show help categories', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      const helpTab = screen.getByRole('tab', { name: /ヘルプ/i });
      fireEvent.click(helpTab);

      expect(screen.getByText('録音')).toBeInTheDocument();
      expect(screen.getByText('分析')).toBeInTheDocument();
      expect(screen.getByText('エクスポート')).toBeInTheDocument();
      expect(screen.getByText('全般')).toBeInTheDocument();
    });

    it('should show help topics when category is selected', () => {
      render(<ChatSupportWidget {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('チャットサポートを開く'));

      const helpTab = screen.getByRole('tab', { name: /ヘルプ/i });
      fireEvent.click(helpTab);

      // Click on recording category
      fireEvent.click(screen.getByText('録音'));

      // Should show recording-related help topics
      expect(screen.getByText('音声録音はどうやって開始しますか？')).toBeInTheDocument();
    });
  });
});
