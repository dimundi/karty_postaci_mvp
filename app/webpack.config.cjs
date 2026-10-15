const path = require('path')
const fs = require('fs')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { installCardCreator } = require('./scripts/card-creator-server.cjs')
const { installTalents } = require('./scripts/talents-server.cjs')
const { installTalentTemplates } = require('./scripts/talent-templates-server.cjs')

const templatesDirectory = '/pdfTemplates/klany'
const archetypesDirectory = '/pdfTemplates/archetypy'

function getRequestedPdf(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost')
  const fileName = url.searchParams.get('file')

  if (!fileName || path.basename(fileName) !== fileName || !fileName.toLowerCase().endsWith('.pdf')) {
    return null
  }

  return fileName
}

function jsonPathForPdf(fileName) {
  return path.join(templatesDirectory, fileName.replace(/\.pdf$/i, '.json'))
}

function jsonPathForArchetypePdf(fileName) {
  return path.join(archetypesDirectory, fileName.replace(/\.pdf$/i, '.json'))
}

function getClanTemplates() {
  return fs
    .readdirSync(templatesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => {
      const configPath = jsonPathForPdf(entry.name)
      const hasConfig = fs.existsSync(configPath)
      let clanName = ''
      let clanId = ''
      let logoFile = ''

      if (hasConfig) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
          clanName = config.clanName ?? ''
          clanId = config.clanId ?? ''
          logoFile = config.logoFile ?? ''
        } catch {
          clanName = ''
          clanId = ''
          logoFile = ''
        }
      }

      return { fileName: entry.name, hasConfig, clanName, clanId, logoFile }
    })
    .sort((first, second) => first.fileName.localeCompare(second.fileName, 'pl'))
}

function getArchetypeTemplates() {
  return fs
    .readdirSync(archetypesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => {
      const configPath = path.join(archetypesDirectory, entry.name.replace(/\.pdf$/i, '.json'))
      const hasConfig = fs.existsSync(configPath)
      let archetypeName = ''

      if (hasConfig) {
        try {
          archetypeName = JSON.parse(fs.readFileSync(configPath, 'utf8')).archetypeName ?? ''
        } catch {
          archetypeName = ''
        }
      }

      return { fileName: entry.name, hasConfig, archetypeName }
    })
    .sort((first, second) => first.fileName.localeCompare(second.fileName, 'pl'))
}

class CopyTemplatesPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('CopyTemplatesPlugin', (compilation) => {
      const outputDirectory = compilation.outputOptions.path
      const destination = path.join(outputDirectory, 'templates')
      const clanDestination = path.join(destination, 'klany')
      const archetypeDestination = path.join(destination, 'archetypy')
      const clanAssetsDestination = path.join(outputDirectory, 'assets', 'clans')

      fs.cpSync('/pdfTemplates', destination, { recursive: true })
      fs.cpSync(path.resolve(__dirname, 'src/assets/clans'), clanAssetsDestination, { recursive: true })
      fs.copyFileSync(path.resolve(__dirname, 'src/assets/fonts/OFL.txt'), path.join(outputDirectory, 'assets', 'NotoSans-OFL.txt'))
      fs.writeFileSync(
        path.join(clanDestination, 'index.json'),
        `${JSON.stringify(getClanTemplates(), null, 2)}\n`,
        'utf8',
      )
      fs.writeFileSync(
        path.join(archetypeDestination, 'index.json'),
        `${JSON.stringify(getArchetypeTemplates(), null, 2)}\n`,
        'utf8',
      )
    })
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk

      if (body.length > 1024 * 1024) {
        reject(new Error('Konfiguracja jest zbyt duża.'))
        request.destroy()
      }
    })

    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

module.exports = (_environment, arguments_) => {
  const isDevelopment = arguments_.mode === 'development'
  const templatesBaseUrl = isDevelopment
    ? '/templates'
    : 'https://whatthefrog.pl/download/Klanarchia/kpostaci/templates'
  const clanLogosBaseUrl = isDevelopment
    ? '/assets/clans'
    : 'https://whatthefrog.pl/download/Klanarchia/kpostaci/assets/clans'

  return {
  entry: isDevelopment ? './src/dev.tsx' : './src/main.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'assets/[name].[contenthash].js',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  watchOptions: {
    ignored: /node_modules/,
    poll: 500,
  },
  module: {
    rules: [
      {
        test: /pdf\.worker\.min\.mjs$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/pdf.worker.[contenthash].js',
        },
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpe?g|webp|svg|ttf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[contenthash][ext]',
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      __TEMPLATES_BASE_URL__: JSON.stringify(templatesBaseUrl),
      __CLAN_LOGOS_BASE_URL__: JSON.stringify(clanLogosBaseUrl),
    }),
    new HtmlWebpackPlugin({
      template: './index.html',
      favicon: './src/assets/favicon.png',
    }),
    ...(!isDevelopment ? [new CopyTemplatesPlugin()] : []),
  ],
  devServer: {
    host: '0.0.0.0',
    port: 8080,
    hot: true,
    historyApiFallback: true,
    static: [
      {
        directory: '/pdfTemplates',
        publicPath: '/templates',
        watch: true,
      },
      {
        directory: path.resolve(__dirname, 'src/assets/clans'),
        publicPath: '/assets/clans',
        watch: true,
      },
    ],
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer.app) {
        throw new Error('Brak aplikacji Webpack Dev Server.')
      }
      installCardCreator(devServer.app)
      installTalents(devServer.app)
      installTalentTemplates(devServer.app)

      devServer.app.get('/user', (_request, response) => {
        response.redirect('/#user')
      })

      devServer.app.get('/api/clan-templates', (_request, response) => {
        response.json(getClanTemplates())
      })

      devServer.app.get('/api/archetype-templates', (_request, response) => {
        response.json(getArchetypeTemplates())
      })

      devServer.app.get('/templates/klany/index.json', (_request, response) => {
        response.json(getClanTemplates())
      })

      devServer.app.get('/templates/archetypy/index.json', (_request, response) => {
        response.json(getArchetypeTemplates())
      })

      devServer.app.get('/api/clan-config', (request, response) => {
        const fileName = getRequestedPdf(request.url)

        if (!fileName) {
          response.status(400).json({ error: 'Nieprawidłowa nazwa pliku PDF.' })
          return
        }

        const configPath = jsonPathForPdf(fileName)

        if (!fs.existsSync(configPath)) {
          response.json({
            exists: false,
            config: {
              version: 1,
              templateFile: fileName,
              clanId: '',
              logoFile: '',
              clanName: '',
              coordinateOrigin: 'top-left',
              fields: [],
            },
          })
          return
        }

        response.json({
          exists: true,
          config: JSON.parse(fs.readFileSync(configPath, 'utf8')),
        })
      })

      devServer.app.post('/api/clan-config', async (request, response) => {
        const fileName = getRequestedPdf(request.url)

        if (!fileName) {
          response.status(400).json({ error: 'Nieprawidłowa nazwa pliku PDF.' })
          return
        }

        try {
          const config = JSON.parse(await readRequestBody(request))

          if (!config || typeof config !== 'object' || !Array.isArray(config.fields)) {
            response.status(400).json({ error: 'Nieprawidłowa konfiguracja.' })
            return
          }

          config.templateFile = fileName
          config.version = 1
          config.coordinateOrigin = 'top-left'

          fs.writeFileSync(jsonPathForPdf(fileName), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
          response.json({ saved: true })
        } catch (error) {
          response.status(400).json({
            error: error instanceof Error ? error.message : 'Nie udało się zapisać konfiguracji.',
          })
        }
      })

      devServer.app.get('/api/archetype-config', (request, response) => {
        const fileName = getRequestedPdf(request.url)

        if (!fileName) {
          response.status(400).json({ error: 'Nieprawidłowa nazwa pliku PDF.' })
          return
        }

        const configPath = jsonPathForArchetypePdf(fileName)

        if (!fs.existsSync(configPath)) {
          response.json({
            exists: false,
            config: {
              version: 1,
              templateFile: fileName,
              archetypeName: '',
              coordinateOrigin: 'top-left',
              fields: [
                {
                  id: 'characterName',
                  type: 'characterName',
                  label: 'Imię lub przydomek',
                  x: 20,
                  y: 20,
                  width: 180,
                  height: 18,
                  fontSize: 10,
                },
                {
                  id: 'clanName',
                  type: 'clanName',
                  label: 'Nazwa klanu',
                  x: 20,
                  y: 50,
                  width: 180,
                  height: 18,
                  fontSize: 10,
                },
              ],
            },
          })
          return
        }

        response.json({
          exists: true,
          config: JSON.parse(fs.readFileSync(configPath, 'utf8')),
        })
      })

      devServer.app.post('/api/archetype-config', async (request, response) => {
        const fileName = getRequestedPdf(request.url)

        if (!fileName) {
          response.status(400).json({ error: 'Nieprawidłowa nazwa pliku PDF.' })
          return
        }

        try {
          const config = JSON.parse(await readRequestBody(request))

          if (!config || typeof config !== 'object' || !Array.isArray(config.fields)) {
            response.status(400).json({ error: 'Nieprawidłowa konfiguracja.' })
            return
          }

          const allowedTypes = new Set(['characterName', 'clanName'])
          config.fields = config.fields.filter((field) => allowedTypes.has(field.type))
          config.templateFile = fileName
          config.version = 1
          config.coordinateOrigin = 'top-left'

          fs.writeFileSync(jsonPathForArchetypePdf(fileName), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
          response.json({ saved: true })
        } catch (error) {
          response.status(400).json({
            error: error instanceof Error ? error.message : 'Nie udało się zapisać konfiguracji.',
          })
        }
      })

      return middlewares
    },
  },
  }
}
