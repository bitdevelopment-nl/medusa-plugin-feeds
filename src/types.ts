export interface PluginOptions {
    enableUI: boolean
    pathToProduct?: string
    salesChannelName?: string[]
    hasIdentifier?: boolean
    feed: {
        title: string
        link: string
        description: string
    }
}
