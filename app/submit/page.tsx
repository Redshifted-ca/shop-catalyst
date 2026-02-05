'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Github, Youtube, CheckCircle, Upload } from 'lucide-react'

interface Submission {
  id: string
  github_url: string
  youtube_url: string
  project_name: string | null
  description: string | null
  submitted_at: string
  updated_at: string
}

export default function SubmitPage() {
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchSubmission()
  }, [])

  const fetchSubmission = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setSubmission(data)
      setGithubUrl(data.github_url)
      setYoutubeUrl(data.youtube_url)
      setProjectName(data.project_name || '')
      setDescription(data.description || '')
    }
    setLoading(false)
  }

  const validateUrls = () => {
    const githubRegex = /^https?:\/\/(www\.)?github\.com\/.+/
    const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/

    if (!githubRegex.test(githubUrl)) {
      setError('Please enter a valid GitHub URL')
      return false
    }

    if (!youtubeRegex.test(youtubeUrl)) {
      setError('Please enter a valid YouTube URL')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!validateUrls()) return

    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const submissionData = {
        user_id: user.id,
        github_url: githubUrl,
        youtube_url: youtubeUrl,
        project_name: projectName || null,
        description: description || null,
      }

      if (submission) {
        // Update existing submission
        const { error } = await supabase
          .from('submissions')
          .update(submissionData)
          .eq('id', submission.id)

        if (error) throw error
        setSuccess('Submission updated successfully!')
      } else {
        // Create new submission
        const { error } = await supabase
          .from('submissions')
          .insert(submissionData)

        if (error) throw error
        setSuccess('Submission created successfully!')
      }

      fetchSubmission()
    } catch (err: any) {
      setError(err.message || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit Your Project</h1>
        <p className="text-gray-600 mb-8">
          Share your hackathon project with us! You can update your submission at any time.
        </p>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name (Optional)
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Awesome Project"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Github className="inline w-4 h-4 mr-1" />
              GitHub Repository URL *
            </label>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Must be a valid GitHub repository URL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Youtube className="inline w-4 h-4 mr-1" />
              YouTube Video URL *
            </label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Demo video or project presentation
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your project..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
          >
            {submitting ? (
              'Submitting...'
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                {submission ? 'Update Submission' : 'Submit Project'}
              </>
            )}
          </button>
        </form>

        {submission && (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Submission History</h3>
            <p className="text-sm text-gray-600">
              Originally submitted: {new Date(submission.submitted_at).toLocaleString()}
            </p>
            {submission.updated_at !== submission.submitted_at && (
              <p className="text-sm text-gray-600">
                Last updated: {new Date(submission.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}