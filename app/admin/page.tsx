'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Package, DollarSign, Upload, Plus, Edit, Trash2, Coins } from 'lucide-react'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: string
  virtual_currency: number
  nfc_id: string | null
}

interface HardwareItem {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  category: string | null
  is_active: boolean
  purchase_limit: number
}

type Tab = 'users' | 'hardware' | 'submissions'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [users, setUsers] = useState<Profile[]>([])
  const [hardware, setHardware] = useState<HardwareItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    if (activeTab === 'users') {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setUsers(data)
    } else if (activeTab === 'hardware') {
      const { data } = await supabase
        .from('hardware_items')
        .select('*')
        .order('name')
      if (data) setHardware(data)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'users', label: 'Users', icon: Users },
            { id: 'hardware', label: 'Hardware', icon: Package },
            { id: 'submissions', label: 'Submissions', icon: Upload },
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'users' && <UsersTab users={users} onUpdate={fetchData} />}
      {activeTab === 'hardware' && <HardwareTab hardware={hardware} onUpdate={fetchData} />}
      {activeTab === 'submissions' && <SubmissionsTab />}
    </div>
  )
}

// Users Tab Component
function UsersTab({ users, onUpdate }: { users: Profile[]; onUpdate: () => void }) {
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [currencyAdjustment, setCurrencyAdjustment] = useState(0)
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [nfcId, setNfcId] = useState('')
  const supabase = createClient()

  const handleCurrencyAdjustment = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('admin_adjust_currency', {
      p_admin_id: user.id,
      p_user_id: userId,
      p_amount: currencyAdjustment,
      p_reason: adjustmentReason
    })

    if (!error) {
      alert('Currency adjusted successfully')
      setCurrencyAdjustment(0)
      setAdjustmentReason('')
      setEditingUser(null)
      onUpdate()
    } else {
      alert('Error: ' + error.message)
    }
  }

  const handleAssignNFC = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ nfc_id: nfcId })
      .eq('id', userId)

    if (!error) {
      alert('NFC ID assigned successfully')
      setNfcId('')
      setEditingUser(null)
      onUpdate()
    } else {
      alert('Error: ' + error.message)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (!error) {
      alert('Role updated successfully')
      onUpdate()
    } else {
      alert('Error: ' + error.message)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NFC ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map(user => (
            <tr key={user.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="font-medium text-gray-900">{user.full_name || 'N/A'}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="participant">Participant</option>
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="font-semibold">{user.virtual_currency}</span>
                <Coins className="inline w-4 h-4 ml-1 text-yellow-500" />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.nfc_id || 'Not assigned'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button
                  onClick={() => setEditingUser(user)}
                  className="text-blue-600 hover:text-blue-900 mr-3"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Edit User: {editingUser.email}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Adjust Currency</label>
                <input
                  type="number"
                  value={currencyAdjustment}
                  onChange={(e) => setCurrencyAdjustment(parseInt(e.target.value) || 0)}
                  placeholder="Amount (+ to add, - to subtract)"
                  className="w-full px-3 py-2 border rounded"
                />
                <input
                  type="text"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Reason for adjustment"
                  className="w-full px-3 py-2 border rounded mt-2"
                />
                <button
                  onClick={() => handleCurrencyAdjustment(editingUser.id)}
                  disabled={!adjustmentReason}
                  className="mt-2 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-300"
                >
                  Apply Currency Change
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Assign NFC ID</label>
                <input
                  type="text"
                  value={nfcId}
                  onChange={(e) => setNfcId(e.target.value)}
                  placeholder="Enter NFC sticker ID"
                  className="w-full px-3 py-2 border rounded"
                />
                <button
                  onClick={() => handleAssignNFC(editingUser.id)}
                  disabled={!nfcId}
                  className="mt-2 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Assign NFC ID
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setEditingUser(null)
                setCurrencyAdjustment(0)
                setAdjustmentReason('')
                setNfcId('')
              }}
              className="mt-4 w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Hardware Tab Component
function HardwareTab({ hardware, onUpdate }: { hardware: HardwareItem[]; onUpdate: () => void }) {
  const [editingItem, setEditingItem] = useState<HardwareItem | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: '',
    purchase_limit: 5, // Default purchase limit
  })
  const supabase = createClient()

  const resetForm = () => {
    setFormData({ name: '', description: '', price: 0, stock: 0, category: '', purchase_limit: 5 })
    setEditingItem(null)
    setIsCreating(false)
  }

  const handleSave = async () => {
    if (editingItem) {
      // Update
      const { error } = await supabase
        .from('hardware_items')
        .update(formData)
        .eq('id', editingItem.id)
      
      if (!error) {
        alert('Item updated')
        resetForm()
        onUpdate()
      }
    } else {
      // Create
      const { error } = await supabase
        .from('hardware_items')
        .insert(formData)
      
      if (!error) {
        alert('Item created')
        resetForm()
        onUpdate()
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      const { error } = await supabase
        .from('hardware_items')
        .delete()
        .eq('id', id)
      
      if (!error) {
        alert('Item deleted')
        onUpdate()
      }
    }
  }

  const startEdit = (item: HardwareItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price,
      stock: item.stock,
      category: item.category || '',
      purchase_limit: 5, // Default value, you can adjust as needed
    })
  }

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Item
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Limit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {hardware.map(item => (
              <tr key={item.id}>
                <td className="px-6 py-4">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.description}</div>
                </td>
                <td className="px-6 py-4 text-sm">{item.category || 'N/A'}</td>
                <td className="px-6 py-4 font-semibold">{item.price}</td>
                <td className="px-6 py-4">{item.stock}</td>
                <td className="px-6 py-4 font-semibold">{item.purchase_limit}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 space-x-2">
                  <button onClick={() => startEdit(item)} className="text-blue-600 hover:text-blue-900">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {(isCreating || editingItem) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">
              {editingItem ? 'Edit Item' : 'Create New Item'}
            </h3>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Item name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="text"
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="text"
                placeholder="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="number"
                placeholder="Price"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="number"
                placeholder="Stock"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="number"
                placeholder="Purchase limit per person"
                value={formData.purchase_limit}
                onChange={(e) => setFormData({ ...formData, purchase_limit: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div className="mt-4 flex space-x-2">
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={resetForm}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Submissions Tab Component
function SubmissionsTab() {
  const [submissions, setSubmissions] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from('submissions')
      .select(`
        *,
        profiles (email, full_name)
      `)
      .order('submitted_at', { ascending: false })
    
    if (data) setSubmissions(data)
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Links</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {submissions.map(sub => (
            <tr key={sub.id}>
              <td className="px-6 py-4">
                <div className="font-medium">{sub.profiles?.full_name || 'N/A'}</div>
                <div className="text-sm text-gray-500">{sub.profiles?.email}</div>
              </td>
              <td className="px-6 py-4">
                <div className="font-medium">{sub.project_name || 'Untitled'}</div>
                <div className="text-sm text-gray-500">{sub.description}</div>
              </td>
              <td className="px-6 py-4 text-sm space-x-2">
                <a href={sub.github_url} target="_blank" className="text-blue-600 hover:underline">
                  GitHub
                </a>
                <a href={sub.youtube_url} target="_blank" className="text-red-600 hover:underline">
                  YouTube
                </a>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(sub.submitted_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}