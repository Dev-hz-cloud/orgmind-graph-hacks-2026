import React from 'react';

/* ==========================================================================
   Answer text renderer
   --------------------------------------------------------------------------
   The backend returns `answer` as lightweight markdown (### headings, **bold**,
   `code`, - bullets, [links](url)). The chat used to never render that field at
   all, so questions without a one-line `direct_answer` looked like they were
   answered with a fixed story card.

   This renders that text as real DOM — no dangerouslySetInnerHTML and no
   markdown dependency, so nothing in the graph data can inject markup.
   ========================================================================== */

type Block =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'number'; text: string }
  | { kind: 'rule' };

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/** Inline markdown → React nodes (bold, inline code, links). */
function renderInline(text: string, keyPrefix = 'i'): React.ReactNode[] {
  return text.split(INLINE_PATTERN).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className="answer-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={key} className="answer-link" href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((rawLine) => {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();

      if (!trimmed) return;
      if (/^-{3,}$/.test(trimmed)) {
        blocks.push({ kind: 'rule' });
        return;
      }

      const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (heading) {
        const level = heading[1].length <= 2 ? 2 : 3;
        blocks.push({ kind: 'heading', level, text: heading[2] });
        return;
      }

      const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
      if (bullet) {
        blocks.push({ kind: 'bullet', text: bullet[1] });
        return;
      }

      const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
      if (numbered) {
        blocks.push({ kind: 'number', text: numbered[1] });
        return;
      }

      blocks.push({ kind: 'paragraph', text: trimmed });
    });

  return blocks;
}

interface AnswerTextProps {
  text: string;
  className?: string;
}

export const AnswerText: React.FC<AnswerTextProps> = ({ text, className }) => {
  const blocks = parseBlocks(text);
  const nodes: React.ReactNode[] = [];

  // Consecutive list items are grouped so the markup stays a real list.
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];

    if (block.kind === 'bullet' || block.kind === 'number') {
      const ordered = block.kind === 'number';
      const items: string[] = [];
      while (i < blocks.length && blocks[i].kind === block.kind) {
        items.push((blocks[i] as { text: string }).text);
        i += 1;
      }
      i -= 1;
      const ListTag = ordered ? 'ol' : 'ul';
      nodes.push(
        <ListTag key={`list-${i}`} className="answer-list">
          {items.map((item, index) => (
            <li key={`${i}-${index}`}>{renderInline(item, `l${i}-${index}`)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    if (block.kind === 'heading') {
      const Tag = block.level === 2 ? 'h3' : 'h4';
      nodes.push(
        <Tag key={`h-${i}`} className={`answer-heading level-${block.level}`}>
          {renderInline(block.text, `h${i}`)}
        </Tag>
      );
      continue;
    }

    if (block.kind === 'rule') {
      nodes.push(<hr key={`hr-${i}`} className="answer-rule" />);
      continue;
    }

    nodes.push(
      <p key={`p-${i}`} className="answer-paragraph">
        {renderInline(block.text, `p${i}`)}
      </p>
    );
  }

  return <div className={className ? `answer-body ${className}` : 'answer-body'}>{nodes}</div>;
};

export default AnswerText;
