// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Peer } from '../../api/types'
import { PeersTab } from './PeersTab'

const peer = (ip: string, extra: Partial<Peer> = {}): Peer => ({
  ip, port: 6881, client: 'qBittorrent 5.1.2', country: 'Нидерланды', country_code: 'nl', connection: 'BT',
  flags: 'D E', flags_desc: 'D = interested', progress: 0.47, dl_speed: 1048576, up_speed: 0, downloaded: 1024, uploaded: 0,
  relevance: 1, files: '', ...extra,
})

describe('PeersTab', () => {
  it('shows connected and swarm counts', () => {
    render(<PeersTab peers={[peer('1.1.1.1'), peer('2.2.2.2')]} swarm={41} variant="desktop" />)
    expect(screen.getByText('2 подключено · 41 в рое')).toBeInTheDocument()
  })

  it('omits the swarm when it is unknown', () => {
    render(<PeersTab peers={[peer('1.1.1.1')]} swarm={null} variant="desktop" />)
    expect(screen.getByText('1 подключено')).toBeInTheDocument()
  })

  it('renders address, client, progress, speeds, and flags with their description', () => {
    render(<PeersTab peers={[peer('1.1.1.1')]} swarm={null} variant="desktop" />)
    expect(screen.getByText('1.1.1.1:6881')).toBeInTheDocument()
    expect(screen.getByText('qBittorrent 5.1.2')).toBeInTheDocument()
    expect(screen.getByText('47%')).toBeInTheDocument()
    expect(screen.getByText('1.00 МБ/с')).toBeInTheDocument()
    expect(screen.getByText('D E')).toHaveAttribute('title', 'D = interested')
  })

  it('shows the country flag with the country name as its label', async () => {
    render(<PeersTab peers={[peer('1.1.1.1')]} swarm={null} variant="desktop" />)
    expect(await screen.findByRole('img', { name: 'Нидерланды' })).toHaveAttribute('src')
  })

  it('renders no flag for an empty or unknown country code, and does not throw', () => {
    render(
      <PeersTab
        peers={[peer('1.1.1.1', { country_code: '', country: '' }), peer('2.2.2.2', { country_code: 'zz', country: 'Нигде' })]}
        swarm={null}
        variant="desktop"
      />,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('mobile renders cards, not a table', () => {
    render(<PeersTab peers={[peer('1.1.1.1')]} swarm={3} variant="mobile" />)
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    expect(screen.getByText('1.1.1.1:6881')).toBeInTheDocument()
  })

  it('shows an empty state without peers', () => {
    render(<PeersTab peers={[]} swarm={null} variant="desktop" />)
    expect(screen.getByText('Нет подключённых пиров')).toBeInTheDocument()
  })
})
