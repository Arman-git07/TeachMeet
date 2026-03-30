import withPWA from 'next-pwa'

const nextConfig = {
  reactStrictMode: true
}

const pwaConfig = withPWA({
  dest: 'public',
  disable: false
})

export default pwaConfig(nextConfig)
