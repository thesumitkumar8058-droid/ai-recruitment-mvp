import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Page from './page'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('Recruitment dashboard', () => {
  it('shows the recruiter login when no token exists', () => {
    render(<Page />)

expect(
      screen.getByRole('heading', { name: 'AI Recruitment MVP' })
    ).toBeTruthy()

expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy()
  })

it('loads the dashboard and navigates to Jobs', async () => {
    localStorage.setItem('token', 'test-token')

vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => []
      })
    )

render(<Page />)

await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Recruitment Dashboard' })
      ).toBeTruthy()
    })

fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))

expect(screen.getByRole('heading', { name: 'Jobs' })).toBeTruthy()
  })
})
