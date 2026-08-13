import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export default function Markdown({ text }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}
