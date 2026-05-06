import { describe, it, expect } from 'vitest';
import { sanitise } from '@/lib/utils/sanitise';

describe('sanitise', () => {
  describe('basic HTML tag stripping', () => {
    it('should strip simple HTML tags', () => {
      expect(sanitise('<p>Hello</p>')).toBe('Hello');
    });

    it('should strip tags with attributes', () => {
      expect(sanitise('<div class="test">content</div>')).toBe('content');
    });

    it('should strip self-closing tags', () => {
      expect(sanitise('Hello<br/>World')).toBe('HelloWorld');
    });

    it('should strip multiple different tags', () => {
      expect(sanitise('<h1>Title</h1><p>Body</p>')).toBe('TitleBody');
    });

    it('should strip anchor tags preserving text', () => {
      expect(sanitise('<a href="http://evil.com">Click me</a>')).toBe('Click me');
    });

    it('should strip img tags', () => {
      expect(sanitise('<img src="x" onerror="alert(1)">')).toBe('');
    });
  });

  describe('script tag removal', () => {
    it('should remove script tags and their content', () => {
      expect(sanitise('<script>alert("xss")</script>')).toBe('');
    });

    it('should remove script tags with attributes', () => {
      expect(sanitise('<script type="text/javascript">malicious()</script>')).toBe('');
    });

    it('should remove script tags with src attribute', () => {
      expect(sanitise('<script src="http://evil.com/hack.js"></script>')).toBe('');
    });

    it('should handle text around script tags', () => {
      expect(sanitise('before<script>evil()</script>after')).toBe('beforeafter');
    });

    it('should remove script tags case-insensitively', () => {
      expect(sanitise('<SCRIPT>alert(1)</SCRIPT>')).toBe('');
      expect(sanitise('<Script>alert(1)</Script>')).toBe('');
    });
  });

  describe('style tag removal', () => {
    it('should remove style tags and their content', () => {
      expect(sanitise('<style>body{display:none}</style>')).toBe('');
    });

    it('should handle text around style tags', () => {
      expect(sanitise('before<style>.x{color:red}</style>after')).toBe('beforeafter');
    });
  });

  describe('nested tags', () => {
    it('should strip deeply nested tags', () => {
      expect(sanitise('<div><span><b>text</b></span></div>')).toBe('text');
    });

    it('should handle nested tags with mixed content', () => {
      expect(sanitise('<div>Hello <span>World</span></div>')).toBe('Hello World');
    });

    it('should handle nested tags with attributes', () => {
      expect(sanitise('<div id="outer"><p class="inner">content</p></div>')).toBe('content');
    });
  });

  describe('malformed HTML', () => {
    it('should handle unclosed tags', () => {
      expect(sanitise('<div>content')).toBe('content');
    });

    it('should handle tags without closing angle bracket gracefully', () => {
      const result = sanitise('<div');
      // Should not contain executable HTML
      expect(result).not.toContain('<div');
    });

    it('should handle extra closing tags', () => {
      expect(sanitise('content</div>')).toBe('content');
    });

    it('should handle tags with extra spaces', () => {
      expect(sanitise('< div >content</ div >')).toBe('content');
    });
  });

  describe('event handler attributes', () => {
    it('should strip tags with onclick', () => {
      expect(sanitise('<div onclick="alert(1)">click</div>')).toBe('click');
    });

    it('should strip tags with onerror', () => {
      expect(sanitise('<img onerror="alert(1)" src="x">')).toBe('');
    });

    it('should strip tags with onload', () => {
      expect(sanitise('<body onload="alert(1)">content</body>')).toBe('content');
    });

    it('should strip tags with onmouseover', () => {
      expect(sanitise('<span onmouseover="steal()">hover me</span>')).toBe('hover me');
    });

    it('should strip SVG with event handlers', () => {
      expect(sanitise('<svg onload="alert(1)"></svg>')).toBe('');
    });
  });

  describe('null/undefined handling', () => {
    it('should return empty string for null', () => {
      expect(sanitise(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(sanitise(undefined)).toBe('');
    });
  });

  describe('plain text passthrough', () => {
    it('should not modify plain text', () => {
      expect(sanitise('Hello, World!')).toBe('Hello, World!');
    });

    it('should not modify text with special characters', () => {
      expect(sanitise('Price: $5.00 & tax')).toBe('Price: $5.00 & tax');
    });

    it('should not modify text with numbers', () => {
      expect(sanitise('Order #12345')).toBe('Order #12345');
    });

    it('should not modify text with unicode', () => {
      expect(sanitise('Héllo Wörld 你好')).toBe('Héllo Wörld 你好');
    });

    it('should handle empty string', () => {
      expect(sanitise('')).toBe('');
    });

    it('should preserve whitespace within text', () => {
      expect(sanitise('hello   world')).toBe('hello   world');
    });
  });

  describe('XSS attack vectors', () => {
    it('should handle javascript: protocol in href', () => {
      expect(sanitise('<a href="javascript:alert(1)">link</a>')).toBe('link');
    });

    it('should handle data: protocol in src', () => {
      expect(sanitise('<img src="data:text/html,<script>alert(1)</script>">')).toBe('');
    });

    it('should handle encoded script tags via HTML entities', () => {
      const input = '&lt;script&gt;alert(1)&lt;/script&gt;';
      const result = sanitise(input);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('</script');
    });

    it('should handle iframe injection', () => {
      expect(sanitise('<iframe src="http://evil.com"></iframe>')).toBe('');
    });

    it('should handle object/embed tags', () => {
      expect(sanitise('<object data="evil.swf"></object>')).toBe('');
      expect(sanitise('<embed src="evil.swf">')).toBe('');
    });
  });
});
