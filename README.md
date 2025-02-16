本文通过一个简单的例子介绍 react + fastapi + docker 容器化开发的基本操作。

# 1 项目初始化

```sh
# 创建并进入项目文件夹
mkdir react_fastapi_docker
cd react_fastapi_docker
# 创建并进入后端文件夹
mkdir backend
# 在 vscode 中打开 react_fastapi_docker
code .   # 需要配置 vscode CLI
```

后端文件夹结构：

```txt
/backend
	requirements.txt
	main.py
	Dockerfile
```

`requirements.txt`:

```txt
fastapi==0.112.2
uvicorn==0.32.1
```

`main.py`:

```python
from fastapi import FastAPI

app = FastAPI()

@app.get('/')
async def test(number: int):
    return {"result": number + 1}
```

`Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY ./requirements.txt ./
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt
COPY . .
EXPOSE 8000
# --reload 启用热重载，允许后续将本地修改同步到容器
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

接下来测试后端能否正常工作。

```sh
# 构建 test_backend 镜像并拉起容器
cd backend
docker build -t test_backend .
docker run -p 8000:8000 test_backend
```

进入 [fastapi 自带的 API 测试界面](http://localhost:8000/docs)。

![image-20250216121928124](https://asdfdasgasd.oss-cn-chengdu.aliyuncs.com/typora_pictures/20250216121928229.png)

返回终端，`control + C` 关闭容器服务。

```sh
# 从 backend 退回到 react_fastapi_docker 目录并初始化前端 react 项目
cd ..
node -v # 检查是否安装了 node，如果没有请先参考其他教程安装 node，否则执行不了下面的命令
npx create-react-app frontend
```

将`frontend/src/App.js`修改如下：

```js
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
      <h2>Test volume1</h2>
      <button onClick={addCount}>Click me</button>
      <p>
        You have clicked the button <strong>{count}</strong> times.
      </p>
    </div>
  );
}
```

具体的逻辑就是：

前端展示一个按钮，同时展示一行信息用来记录你点击按钮的次数，次数的修改和获取是从后端 fastapi 获取的。

添加`frontend/Dockerfile`。

删除 frontend 下的无用文件以减小构建出来的镜像的体积，仅保留下述文件：

```txt
/frontend
	/node_modules
	/public
		index.html
	/src
		App.js
		index.js
	package-lock.json
	package.json
	Dockerfile
```

`Dockerfile`:

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY ./package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD [ "npm", "run", "start" ]
```

添加`frontend/.dockerignore`:

```dockerfile
node_modules
```

从而确保`node_modules`文件夹不会被 copy 到镜像中，因为构建镜像的时候已经安装了所有环境文件，再有`node_modules`只会造成冗余。

将`frontend/src/index.js`修改如下：

```js
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

# 2 docker-compose.yml 组合容器服务

创建`react_fastapi_docker/docker-compose.yml`:

```yml
services:
  backend:
    build:
      context: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app # 将 ./backend 文件夹下的内容挂载到 /app 目录下，从而使得本地修改被同步到容器中
  frontend:
    build:
      context: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    volumes:
      - /app/node_modules # 保留容器中的 node_modules 目录
      - ./frontend:/app
```

# 3 测试前端同步

确保当前在`react_fastapi_docker`目录下，执行`docker-compose up`拉起容器服务。

进入[前端服务所映射的 localhost:3000 端口](http://localhost:3000)，显示如下内容：

![image-20250216125218515](https://asdfdasgasd.oss-cn-chengdu.aliyuncs.com/typora_pictures/20250216125218607.png)

首先测试本地修改是否可以同步到容器中。

试着将`frontend/src/App.js`中的`<h2>Test volume1</h2>`修改成`<h2>Test volume2</h2>`或其他内容并保存，看看是否能够同步到前端界面中。

若可以则说明前端的同步开发设置已经完成。

# 4 测试前后端连接

点击`Click me`按钮，显示如下错误：

![image-20250216125651558](https://asdfdasgasd.oss-cn-chengdu.aliyuncs.com/typora_pictures/20250216125651617.png)

![image-20250216125704981](https://asdfdasgasd.oss-cn-chengdu.aliyuncs.com/typora_pictures/20250216125705029.png)

这是因为：

前端运行在本地 3000 端口，后端运行在本地 8000 端口，不同端口之间的请求属于跨域访问，而跨域访问默认是不被允许的，需要在后端中设置，允许跨域访问。

参考 [fastapi 官方文档](https://fastapi.tiangolo.com/tutorial/cors/) 得出如下解决方案：

在`backend/main.py`中添加内容，最终内容如下：

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 端口不同，属于跨域请求，所以需要设置 CORS，即允许跨域请求
origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get('/')
async def test(number: int):
    return {"result": number + 1}
```

回到前端界面中，刷新，接下来点击`Click me`，可以看到数字正常增加并显示，说明前后端连接建立成功。

# 5 测试后端同步

尝试修改`backend/main.py`，把`return {"result": number + 1}`改成`return {"result": number + 2}`，保存后来到前端界面并刷新，点击`Click me`，如果这次数字以 2 为单位增加则说明后端同步正常。
