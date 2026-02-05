'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Github, Youtube, User, Calendar, Sparkles, ExternalLink } from 'lucide-react'

interface Submission {
  id: string
  github_url: string
  youtube_url: string
  project_name: string | null
  description: string | null
  submitted_at: string
  profiles: {
    email: string
    full_name: string | null
  }
}

export default function GalleryPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        profiles (
          email,
          full_name
        )
      `)
      .order('submitted_at', { ascending: false })

    if (data) {
      setSubmissions(data as any)
    }
    setLoading(false)
  }

  const getYoutubeEmbedUrl = (url: string) => {
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)
    if (videoIdMatch) {
      return `https://www.youtube.com/embed/${videoIdMatch[1]}`
    }
    return null
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
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-40 right-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-transparent bg-clip-text mb-4">
            Project Gallery
          </h1>
          <p className="text-gray-400 text-lg">
            Explore the incredible creations from our hackathon participants
          </p>
          <div className="mt-4 flex items-center justify-center space-x-2">
            <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
            <span className="text-cyan-300 font-semibold">{submissions.length} Projects Submitted</span>
            <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-20 bg-gray-900/40 backdrop-blur-sm border border-cyan-500/20 rounded-2xl">
            <Sparkles className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-cyan-300 mb-2">No submissions yet</h3>
            <p className="text-gray-400">Be the first to submit your project!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {submissions.map((submission, index) => {
              const embedUrl = getYoutubeEmbedUrl(submission.youtube_url)
              
              return (
                <div
                  key={submission.id}
                  className="group bg-gray-900/60 backdrop-blur-sm border border-cyan-500/30 rounded-2xl overflow-hidden hover:border-cyan-400/60 hover:shadow-xl hover:shadow-cyan-500/20 transition-all duration-300"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Video Embed */}
                  {embedUrl && (
                    <div className="relative aspect-video bg-black">
                      <iframe
                        src={embedUrl}
                        title={submission.project_name || 'Project Demo'}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  )}

                  <div className="p-6">
                    {/* Project Name */}
                    <h2 className="text-2xl font-bold text-cyan-300 mb-3 group-hover:text-cyan-200 transition-colors">
                      {submission.project_name || 'Untitled Project'}
                    </h2>

                    {/* Author Info */}
                    <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-cyan-500/20">
                      <div className="bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full p-2">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-300">
                          {submission.profiles?.full_name || 'Anonymous'}
                        </p>
                        <p className="text-xs text-gray-500">{submission.profiles?.email}</p>
                      </div>
                    </div>

                    {/* Description */}
                    {submission.description && (
                      <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                        {submission.description}
                      </p>
                    )}

                    {/* Links */}
                    <div className="flex space-x-3 mb-4">
                    {/* GitHub Link */}
                    <a
                        href={submission.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center space-x-2 bg-gray-800/50 hover:bg-gray-700/50 border border-cyan-500/30 text-cyan-300 py-2 px-4 rounded-lg transition-all group/btn"
                    >
                        <Github className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                        <span className="text-sm font-semibold">Code</span>
                        <ExternalLink className="w-3 h-3" />
                    </a>

                    {/* YouTube Link */}
                    <a
                        href={submission.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center space-x-2 bg-red-900/30 hover:bg-red-800/40 border border-red-500/30 text-red-300 py-2 px-4 rounded-lg transition-all group/btn"
                    >
                        <Youtube className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                        <span className="text-sm font-semibold">Video</span>
                        <ExternalLink className="w-3 h-3" />
                    </a>
                    </div>

                    {/* Submission Date */}
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>Submitted {new Date(submission.submitted_at).toLocaleDateString()}</span>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}