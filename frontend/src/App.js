import React, { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  async function addCount() {
    const res = await fetch(`http://localhost:8000?number=${count}`); // 模板字符串，支持使用 ${} 嵌入变量
    const data = await res.json();
    setCount(data.result);
  }

  return (
    <div>
      <h1>This is frontend</h1>
      <h2>Test volume3</h2>
      <button onClick={addCount}>Click me</button>
      <p>
        You have clicked the button <strong>{count}</strong> times.
      </p>
    </div>
  );
}
