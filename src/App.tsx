import { Wrench } from 'lucide-react'

function App() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Wrench className="w-16 h-16 text-blue-500" />
        </div>
        <h1 className="text-5xl font-bold text-white mb-4">Asentaja MVP</h1>
        <p className="text-gray-400 text-lg">Tervetuloa</p>
      </div>
    </div>
  )
}

export default App
