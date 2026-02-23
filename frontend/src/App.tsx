import { Routes, Route, Link, useLocation } from 'react-router'
import ReceiptList from './pages/ReceiptList'
import ReceiptDetailPage from './pages/ReceiptDetail'
import ReviewQueue from './pages/ReviewQueue'
import Exports from './pages/Exports'

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation()
  const isActive = location.pathname === to
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-gray-900 text-white'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {children}
    </Link>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900 mr-4">
                Receipt OCR
              </h1>
              <NavLink to="/">Receipts</NavLink>
              <NavLink to="/review">Review</NavLink>
              <NavLink to="/exports">Exports</NavLink>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<ReceiptList />} />
          <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/exports" element={<Exports />} />
        </Routes>
      </main>
    </div>
  )
}
