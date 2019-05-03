/**
 * @author Toru Nagashima
 * See LICENSE file in root directory for full license.
 */
"use strict"

const path = require("path")
const fs = require("fs")
const getImportExportTargets = require("../util/get-import-export-targets")
const getTryExtensions = require("../util/get-try-extensions")

/**
 * Get all file extensions of the files which have the same basename.
 * @param {string} filePath The path to the original file to check.
 * @returns {string[]} File extensions.
 */
function getExistingExtensions(filePath) {
    const basename = path.basename(filePath, path.extname(filePath))
    try {
        return fs
            .readdirSync(path.dirname(filePath))
            .filter(
                filename =>
                    path.basename(filename, path.extname(filename)) === basename
            )
            .map(filename => path.extname(filename))
    } catch (_error) {
        return []
    }
}

module.exports = {
    meta: {
        docs: {
            description:
                "enforce the style of file extensions in `import` declarations",
            category: "Stylistic Issues",
            recommended: false,
            url:
                "https://github.com/mysticatea/eslint-plugin-node/blob/v8.0.1/docs/rules/file-extension-in-import.md",
        },
        fixable: "code",
        messages: {
            requireExt: "require file extension '{{ext}}'.",
            forbidExt: "forbid file extension '{{ext}}'.",
        },
        schema: [
            {
                enum: ["always", "never"],
            },
            {
                type: "object",
                properties: {
                    tryExtensions: getTryExtensions.schema,
                },
                additionalProperties: {
                    enum: ["always", "never"],
                },
            },
        ],
        type: "suggestion",
    },
    create(context) {
        if (context.getFilename().startsWith("<")) {
            return {}
        }
        const defaultStyle = context.options[0] || "always"
        const overrideStyle = context.options[1] || {}

        function verify({ filePath, name, node }) {
            // Ignore if it's not resolved to a file or it's a bare module.
            if (!filePath || !/[/\\]/u.test(name)) {
                return
            }

            // Get extension.
            const originalExt = path.extname(name)
            const resolvedExt = path.extname(filePath)
            const existingExts = getExistingExtensions(filePath)
            if (!resolvedExt && existingExts.length !== 1) {
                // Ignore if the file extension could not be determined one.
                return
            }
            const ext = resolvedExt || existingExts[0]
            const style = overrideStyle[ext] || defaultStyle

            // Verify.
            if (style === "always" && ext !== originalExt) {
                context.report({
                    node,
                    messageId: "requireExt",
                    data: { ext },
                    fix(fixer) {
                        if (existingExts.length !== 1) {
                            return null
                        }
                        const index = node.range[1] - 1
                        return fixer.insertTextBeforeRange([index, index], ext)
                    },
                })
            } else if (style === "never" && ext === originalExt) {
                context.report({
                    node,
                    messageId: "forbidExt",
                    data: { ext },
                    fix(fixer) {
                        if (existingExts.length !== 1) {
                            return null
                        }
                        const index = name.lastIndexOf(ext)
                        const start = node.range[0] + 1 + index
                        const end = start + ext.length
                        return fixer.removeRange([start, end])
                    },
                })
            }
        }

        return {
            "Program:exit"(node) {
                const opts = { optionIndex: 1 }
                getImportExportTargets(context, node, opts).forEach(verify)
            },
        }
    },
}