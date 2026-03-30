import withPWA from 'next-pwa'

const nextConfig = {
  reactStrictMode: true
}

export default withPWA({
  ...nextConfig,
  pwa: {
    dest: 'public',
    disable: false
  }
})
