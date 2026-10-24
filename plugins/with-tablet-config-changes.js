const {
  withAndroidManifest,
  createRunOncePlugin,
} = require('@expo/config-plugins')

const REQUIRED = [
  'orientation',
  'screenSize',
  'screenLayout',
  'smallestScreenSize',
  'density',
]

function ensureConfigChanges(value) {
  const changes = new Set(
    String(value || '')
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean),
  )
  for (const change of REQUIRED) changes.add(change)
  return [...changes].join('|')
}

function withTabletConfigChanges(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0]
    const activities = application?.activity ?? []
    for (const activity of activities) {
      const name = activity.$?.['android:name']
      if (name !== '.MainActivity' && name !== 'cc.agentlabs.opencode.MainActivity') continue
      activity.$['android:configChanges'] = ensureConfigChanges(activity.$['android:configChanges'])
      delete activity.$['android:screenOrientation']
    }
    return config
  })
}

module.exports = createRunOncePlugin(
  withTabletConfigChanges,
  'with-tablet-config-changes',
  '1.0.0',
)
