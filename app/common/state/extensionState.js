/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { makeImmutable } = require('./immutableUtil')
const Immutable = require('immutable')
const windowConstants = require('../../../js/constants/windowConstants')
const platformUtil = require('../lib/platformUtil')

const browserActionDefaults = Immutable.fromJS({
  tabs: {}
})

const extensionState = {

  getExtensions: (state) => {
    return state.get('extensions')
  },

  getEnabledExtensions: (state) => {
    return state.get('extensions').filter((installInfo, extensionId) => {
      return installInfo.get('enabled') === true
    })
  },

  getExtensionById: (state, extensionId) => {
    return state.getIn(['extensions', extensionId])
  },

  getBrowserActionByTabId: (state, extensionId, tabId) => {
    tabId = tabId ? tabId.toString() : '-1'
    let extension = extensionState.getExtensionById(state, extensionId)
    if (extension && extension.get('browserAction')) {
      let icons = extension.getIn(['manifest', 'icons'])
      let defaultIcons = extension.getIn(['manifest', 'browser_action', 'default_icon'])
      let tabBrowserAction = extension.getIn(['tabs', tabId]) || Immutable.Map()
      return extension.get('browserAction').merge({icons, defaultIcons}).merge(tabBrowserAction).merge({base_path: extension.get('base_path')})
    }
    return null
  },

  browserActionRegistered: (state, action) => {
    action = makeImmutable(action)
    state = makeImmutable(state)
    let extensionId = action.get('extensionId').toString()
    let extension = extensionState.getExtensionById(state, extensionId)
    if (extension) {
      extension = extension.set('browserAction', browserActionDefaults.merge(action.get('browserAction')))
      return state.setIn(['extensions', extensionId], extension)
    } else {
      return state
    }
  },

  browserActionUpdated: (state, action) => {
    action = makeImmutable(action)
    state = makeImmutable(state)
    if (action.get('actionType') === windowConstants.WINDOW_SET_NAVIGATED &&
      action.get('tabId')) {
      let tabId = action.get('tabId')
      let extensions = extensionState.getEnabledExtensions(state)
      extensions && extensions.forEach((extension) => {
        let tabs = extension.getIn(['browserAction', 'tabs'])
        if (tabs && tabs.get(tabId)) {
          tabs = tabs.set(tabId, Immutable.Map())
          extension = extension.setIn(['browserAction', 'tabs'], tabs)
          state = state.setIn(['extensions', extension.get('id')], extension)
        }
      })
      return state
    }
    let extensionId = action.get('extensionId').toString()
    let extension = extensionState.getExtensionById(state, extensionId)
    if (extension && extension.get('browserAction')) {
      let tabId = action.get('tabId')
      if (tabId) {
        let tabs = extension.getIn(['browserAction', 'tabs'])
        let tab = tabs.get(tabId) || Immutable.Map()
        tabs = tabs.set(tabId, tab.merge(action.get('browserAction')))
        extension = extension.setIn(['browserAction', 'tabs'], tabs)
      } else {
        extension = extension.set('browserAction', extension.get('browserAction').merge(action.get('browserAction')))
      }
      return state.setIn(['extensions', extensionId], extension)
    } else {
      return state
    }
  },

  browserActionBackgroundImage: (browserAction, tabId) => {
    tabId = tabId ? tabId.toString() : '-1'
    let basePath = browserAction.get('base_path')
    if (basePath) {
      let baseIcons19 = browserAction.getIn(['icons', '19'])
      let baseIcons38 = browserAction.getIn(['icons', '38'])
      if (baseIcons19 && baseIcons38) {
        return `-webkit-image-set(
                  url(${basePath}/${baseIcons19}) 1x,
                  url(${basePath}/${baseIcons38}) 2x`
      }
      let tabsPath19 = browserAction.getIn(['tabs', tabId, 'path', '19'])
      let tabsPath38 = browserAction.getIn(['tabs', tabId, 'path', '38'])
      if (tabsPath19 && tabsPath38) {
        return `-webkit-image-set(
                  url(${basePath}/${tabsPath19}) 1x,
                  url(${basePath}/${tabsPath38}) 2x`
      }
      let basePath19 = browserAction.getIn(['path', '19'])
      let basePath38 = browserAction.getIn(['path', '38'])
      if (basePath19 && basePath38) {
        return `-webkit-image-set(
                  url(${basePath}/${basePath19}) 1x,
                  url(${basePath}/${basePath38}) 2x`
      }
      let baseIcons16 = browserAction.getIn(['icons', '16'])
      let baseIcons48 = browserAction.getIn(['icons', '48'])
      if (baseIcons16 && baseIcons48) {
        return `-webkit-image-set(
                  url(${basePath}/${baseIcons16}) 1x,
                  url(${basePath}/${baseIcons48}) 2x`
      }
    }
    return ''
  },

  extensionInstalled: (state, action) => {
    action = makeImmutable(action)
    state = makeImmutable(state)
    let extensionId = action.get('extensionId').toString()
    return state.setIn(['extensions', extensionId], action.get('installInfo'))
  },

  extensionEnabled: (state, action) => {
    action = makeImmutable(action)
    state = makeImmutable(state)
    let extensionId = action.get('extensionId').toString()
    let extension = extensionState.getExtensionById(state, extensionId)
    if (extension) {
      return state.setIn(['extensions', extensionId], extension.set('enabled', true))
    } else {
      return state
    }
  },

  extensionDisabled: (state, action) => {
    action = makeImmutable(action)
    state = makeImmutable(state)
    let extensionId = action.get('extensionId').toString()
    let extension = extensionState.getExtensionById(state, extensionId)
    if (extension) {
      return state.setIn(['extensions', action.get('extensionId')], extension.set('enabled', false))
    } else {
      return state
    }
  },

  getPersistentTabState: (extension) => {
    extension = makeImmutable(extension)
    extensionState.getTransientFields().forEach((field) => {
      extension = extension.delete(field)
    })
    return extension
  },

  contextMenuCreated: (state, action) => {
    action = makeImmutable(action)
    state = makeImmutable(state)
    let extensionId = action.get('extensionId').toString()
    let extension = extensionState.getExtensionById(state, extensionId)
    if (extension) {
      if (state.getIn(['extensions', action.get('extensionId'), 'contextMenus']) === undefined) {
        state = state.setIn(['extensions', action.get('extensionId'), 'contextMenus'], new Immutable.List())
      }
      let contextMenus = state.getIn(['extensions', action.get('extensionId'), 'contextMenus'])
      const basePath =
        platformUtil.getPathFromFileURI(state.getIn(['extensions', action.get('extensionId'), 'base_path']))
      const iconPath = action.get('icon')
      if (!iconPath) {
        contextMenus = contextMenus.push({
          extensionId: action.get('extensionId'),
          menuItemId: action.get('menuItemId'),
          properties: action.get('properties').toJS()
        })
      } else {
        contextMenus = contextMenus.push({
          extensionId: action.get('extensionId'),
          menuItemId: action.get('menuItemId'),
          properties: action.get('properties').toJS(),
          icon: basePath + '/' + iconPath
        })
      }
      return state.setIn(['extensions', action.get('extensionId'), 'contextMenus'],
        contextMenus)
    } else {
      return state
    }
  },

  contextMenuAllRemoved: (state, action) => {
    action = makeImmutable(action)
    state = makeImmutable(state)
    let extensionId = action.get('extensionId').toString()
    let extension = extensionState.getExtensionById(state, extensionId)
    if (extension) {
      return state.deleteIn(['extensions', action.get('extensionId'), 'contextMenus'])
    } else {
      return state
    }
  },

  getContextMenusProperties: (state) => {
    let allProperties = []
    let extensions = extensionState.getEnabledExtensions(state)
    extensions && extensions.forEach((extension) => {
      let contextMenus = extension.get('contextMenus')
      contextMenus && contextMenus.forEach((contextMenu) => {
        allProperties.push(contextMenu.toJS())
      })
    })
    return allProperties
  }
}

module.exports = extensionState
