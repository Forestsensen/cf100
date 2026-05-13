export const runtime = 'edge';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-gray-500">页面未找到</p>
        <a href="/" className="mt-4 inline-block text-blue-500 hover:underline">
          返回首页
        </a>
      </div>
    </div>
  );
}
