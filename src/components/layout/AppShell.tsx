import React from 'react'
import { Outlet } from 'react-router-dom'
import { TopNav } from './TopNav'

export const AppShell: React.FC = () => {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopNav />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
