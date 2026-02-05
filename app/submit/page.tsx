'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Github, Youtube, CheckCircle, Upload, Sparkles, Rocket } from 'lucide-react'

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
        const { error } = await supabase
          .from('submissions')
          .update(submissionData)
          .eq('id', submission.id)

        if (error) throw error
        setSuccess('Submission updated successfully! 🚀')
      } else {
        const { error } = await supabase
          .from('submissions')
          .insert(submissionData)

        if (error) throw error
        setSuccess('Submission created successfully! 🚀')
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
      <div className="min-h-screen bg-gradient-to-b from-black via-blue-950 to-cyan-950 flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
          <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-cyan-400 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-blue-950 to-cyan-950 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      {/* Nebula effects */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 left-1/3 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-900/60 backdrop-blur-sm border border-cyan-500/30 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <Rocket className="w-16 h-16 text-cyan-400 animate-bounce" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 text-transparent bg-clip-text mb-2">
              Submit Your Project
            </h1>
            <p className="text-gray-400">
              Share your creation with the universe! You can update anytime.
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-900/50 backdrop-blur-sm border border-red-500/50 text-red-200 px-6 py-4 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-900/50 backdrop-blur-sm border border-green-500/50 text-green-200 px-6 py-4 rounded-lg flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-cyan-300 text-sm font-semibold mb-2">
                Project Name (Optional)
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Galactic Project"
                className="w-full px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg 
                         focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                         text-white placeholder-gray-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-cyan-300 text-sm font-semibold mb-2 flex items-center">
                <Github className="w-4 h-4 mr-2" />
                GitHub Repository URL *
              </label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                required
                className="w-full px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg 
                         focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                         text-white placeholder-gray-500 transition-all"
              />
              <p className="mt-2 text-sm text-gray-500">
                Your code repository on GitHub
              </p>
            </div>

            <div>
              <label className="block text-cyan-300 text-sm font-semibold mb-2 flex items-center">
                <Youtube className="w-4 h-4 mr-2" />
                YouTube Video URL *
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                required
                className="w-full px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg 
                         focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                         text-white placeholder-gray-500 transition-all"
              />
              <p className="mt-2 text-sm text-gray-500">
                Demo video or project presentation
              </p>
            </div>

            <div>
              <label className="block text-cyan-300 text-sm font-semibold mb-2">
                Project Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your incredible creation..."
                rows={5}
                className="w-full px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg 
                         focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                         text-white placeholder-gray-500 transition-all resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 
                       disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed 
                       text-white font-bold py-4 px-4 rounded-lg transition-all duration-200
                       shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting to the cosmos...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  {submission ? 'Update Submission' : 'Launch Submission'}
                </>
              )}
            </button>
          </form>

          {submission && (
            <div className="mt-8 pt-8 border-t border-cyan-500/30">
              <h3 className="font-semibold text-cyan-300 mb-3 flex items-center">
                <Sparkles className="w-4 h-4 mr-2" />
                Submission History
              </h3>
              <div className="bg-gray-800/30 rounded-lg p-4 space-y-2">
                <p className="text-sm text-gray-400">
                  <span className="text-cyan-400 font-semibold">Originally submitted:</span>{' '}
                  {new Date(submission.submitted_at).toLocaleString()}
                </p>
                {submission.updated_at !== submission.submitted_at && (
                  <p className="text-sm text-gray-400">
                    <span className="text-cyan-400 font-semibold">Last updated:</span>{' '}
                    {new Date(submission.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}