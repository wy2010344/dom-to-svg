使用 PUPPETEER_SKIP_DOWNLOAD=true npm install 安装
增加了 convert 函数,对于像 linear-gradient( 180deg, #dcecff 9.875rem, #ffffff 10.625rem, #ffffff 100% ),使用

```ts
const svgDocument = elementToSVG(which, {
	convert(gradient) {
		return gradient.replace(/(\d+\.?\d*)rem/g, (match, remValue) => {
			return `${relatePx(remValue)}px`
		})
	},
})
```

将 rem 转为 px,这样内部库里的 gradient-parser 就能识别了
不能很好地支持 z-index,需要手动放到最后面
对 border-radius 没有支持.....
最好还是换用 canvas 如 react-konva
https://github.com/wy2010344/dom-to-svg

# DOM to SVG

[![npm](https://img.shields.io/npm/v/dom-to-svg)](https://www.npmjs.com/package/dom-to-svg)
[![CI status](https://github.com/felixfbecker/dom-to-svg/workflows/test/badge.svg?branch=main)](https://github.com/felixfbecker/dom-to-svg/actions)
![license: MIT](https://img.shields.io/npm/l/dom-to-svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Library to convert a given HTML DOM node into an accessible SVG "screenshot".

## Demo 📸

Try out the [SVG Screenshots Chrome extension](https://chrome.google.com/webstore/detail/svg-screenshot/nfakpcpmhhilkdpphcjgnokknpbpdllg) which uses this library to allow you to take SVG screenshots of any webpage.
You can find the source code at [github.com/felixfbecker/svg-screenshots](https://github.com/felixfbecker/svg-screenshots).

## Usage

```js
import { documentToSVG, elementToSVG, inlineResources, formatXML } from 'dom-to-svg'

// Capture the whole document
const svgDocument = documentToSVG(document)

// Capture specific element
const svgDocument = elementToSVG(document.querySelector('#my-element'))

// Inline external resources (fonts, images, etc) as data: URIs
await inlineResources(svgDocument.documentElement)

// Get SVG string
const svgString = new XMLSerializer().serializeToString(svgDocument)
```

The output can be used as-is as valid SVG or easily passed to other packages to pretty-print or compress.

## Features

- Does NOT rely on `<foreignObject>` - SVGs will work in design tools like Illustrator, Figma etc.
- Maintains DOM accessibility tree by annotating SVG with correct ARIA attributes.
- Maintains interactive links.
- Maintains text to allow copying to clipboard.
- Can inline external resources like images, fonts, etc to make SVG self-contained.
- Maintains CSS stacking order of elements.
- Outputs debug attributes on SVG to trace elements back to their DOM nodes.

## Caveats

- Designed to run in the browser. Using JSDOM on the server will likely not work, but it can easily run inside Puppeteer.
