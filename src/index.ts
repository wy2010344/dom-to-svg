import { svgNamespace, isSVGImageElement, isSVGStyleElement, xlinkNamespace } from './dom'
import { fetchAsDataURL as defaultFetchAsDataURL } from './inline'
import { walkNode } from './traversal'
import { createStackingLayers } from './stacking'
import { createIdGenerator, withTimeout } from './util'
import { isCSSFontFaceRule } from './css'
import cssValueParser from 'postcss-value-parser'

export interface DomToSvgOptions {
	/**
	 * To visual area to contrain the SVG too.
	 * Elements that do not intersect the capture area are not included in the SVG.
	 */
	captureArea?: DOMRectReadOnly
}

export function documentToSVG(document: Document, options?: DomToSvgOptions): XMLDocument {
	return elementToSVG(document.documentElement, options)
}

export function elementToSVG(element: Element, options?: DomToSvgOptions): XMLDocument {
	const svgDocument = element.ownerDocument.implementation.createDocument(svgNamespace, 'svg', null) as XMLDocument

	const svgElement = (svgDocument.documentElement as unknown) as SVGSVGElement
	svgElement.setAttribute('xmlns', svgNamespace)
	svgElement.setAttribute('xmlns:xlink', xlinkNamespace)
	svgElement.append(
		svgDocument.createComment(` Generated by dom-to-svg from ${element.ownerDocument.location.href} `)
	)

	// Copy @font-face rules
	const styleElement = svgDocument.createElementNS(svgNamespace, 'style')
	for (const styleSheet of element.ownerDocument.styleSheets) {
		let rules: CSSRuleList | undefined
		try {
			rules = styleSheet.rules
		} catch (error) {
			console.error('Could not access rules of styleSheet', styleSheet, error)
		}
		// Make font URLs absolute (need to be resolved relative to the stylesheet)
		for (const rule of rules ?? []) {
			if (!isCSSFontFaceRule(rule)) {
				continue
			}
			const styleSheetHref = rule.parentStyleSheet?.href
			if (styleSheetHref) {
				const parsedSourceValue = cssValueParser(rule.style.src)
				parsedSourceValue.walk(node => {
					if (node.type === 'function' && node.value === 'url' && node.nodes[0]) {
						const urlArgumentNode = node.nodes[0]
						if (urlArgumentNode.type === 'string' || urlArgumentNode.type === 'word') {
							urlArgumentNode.value = new URL(
								urlArgumentNode.value.replace(/\\(.)/g, '$1'),
								styleSheetHref
							).href
						}
					}
				})
				rule.style.src = cssValueParser.stringify(parsedSourceValue.nodes)
			}
			styleElement.append(rule.cssText, '\n')
		}
	}
	svgElement.append(styleElement)

	walkNode(element, {
		svgDocument,
		currentSvgParent: svgElement,
		stackingLayers: createStackingLayers(svgElement),
		parentStackingLayer: svgElement,
		getUniqueId: createIdGenerator(),
		labels: new Map<HTMLLabelElement, string>(),
		captureArea: options?.captureArea ?? element.getBoundingClientRect(),
	})

	const bounds = options?.captureArea ?? element.getBoundingClientRect()
	svgElement.setAttribute('width', bounds.width.toString())
	svgElement.setAttribute('height', bounds.height.toString())
	svgElement.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`)

	return svgDocument
}

declare global {
	interface SVGStyleElement extends LinkStyle {}
}

export interface InlineResourcesOptions {
	fetchAsDataURL?: (url: string) => Promise<URL>
}

export async function inlineResources(element: Element, options: InlineResourcesOptions = {}): Promise<void> {
	const { fetchAsDataURL = defaultFetchAsDataURL } = options
	if (isSVGImageElement(element)) {
		const dataURL = await withTimeout(5000, `Timeout fetching ${element.href.baseVal}`, () =>
			fetchAsDataURL(element.href.baseVal)
		)
		element.dataset.src = element.href.baseVal
		element.setAttribute('href', dataURL.href)
	} else if (isSVGStyleElement(element) && element.sheet) {
		try {
			const rules = element.sheet.cssRules
			for (const rule of rules) {
				if (isCSSFontFaceRule(rule)) {
					const parsedSourceValue = cssValueParser(rule.style.src)
					const promises: Promise<void>[] = []
					parsedSourceValue.walk(node => {
						if (node.type === 'function' && node.value === 'url' && node.nodes[0]) {
							const urlArgumentNode = node.nodes[0]
							if (urlArgumentNode.type === 'string' || urlArgumentNode.type === 'word') {
								const url = new URL(urlArgumentNode.value.replace(/\\(.)/g, '$1'))
								promises.push(
									(async () => {
										const dataUrl = await withTimeout(5000, `Timeout fetching ${url.href}`, () =>
											fetchAsDataURL(url.href)
										)
										urlArgumentNode.value = dataUrl.href
									})()
								)
							}
						}
					})
					await Promise.all(promises)
					rule.style.src = cssValueParser.stringify(parsedSourceValue.nodes)
				}
			}
		} catch (error) {
			console.error('Error inlining stylesheet', element.sheet, error)
		}
	}
	await Promise.all([...element.children].map(element => inlineResources(element, options)))
}

export { fetchAsDataURL } from './inline'
