/**
 * 输出的工具对象
 */
const _ = {}

/**
 * 适配requestAniamtionFrame，让浏览器在适当的时候执行某些行为
 */
_.rAF =
  window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.oRequestAnimationFrame ||
  window.msRequestAnimationFrame ||
  (cb => window.setTimeout(cb, 1000 / 60))

/**
 * 当前浏览器所使用的样式前缀
 */
const _elementStyle = document.createElement('div').style
const _vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT']
  .map(t => `${ t }ransform`)
  .filter(t => t in _elementStyle)
  .map(t => t.replace(/(t|T)ransform/g, ''))

// 增加前缀
/**
 * 增加样式前缀
 * @param  {String} style 要增加前缀的样式
 * @return {String}       增加玩前缀的样式
 */
const _prefixStyle = style =>
  (_vendors.length && _vendors[0] ? `${ _vendors[0] }${ style.charAt(0).toUpperCase() }${ style.substr(1) }` : style)


/**
 * 获取当前时间
 * @return {timestamp} 当前时间戳
 */
_.getTime = Date.now || (() => new Date().getTime())

// 扩展函数
/**
 * 扩展函数
 * @param  {Object}    target 目标对象
 * @param  {...Object} objs   源对象数组
 * @return {Object}           扩展后的对象
 */
_.extend = (target, ...objs) => {
  const len = objs.length
  if (!len) {
    return target
  }

  for (let i = 0; i < len; i++) {
    const source = objs[i]
    const keys = Object.keys(source)
    const l = keys.length

    for (let j = 0; j < l; j++) {
      const key = keys[j]
      target[key] = source[key]
    }
  }

  return target
}

/**
 * 增加事件监听
 * @param  {Dom Element} el      要增加监听的元素
 * @param  {String}      type    监听的事件类型
 * @param  {Function}    fn      触发的回调函数
 * @param  {Boolean}     capture 在事件什么阶段触发毁掉函数
 * @return {null}
 */
_.addEvent = (el, type, fn, capture) => {
  el.addEventListener(type, fn, !!capture)
}

/**
 * 移除事件监听
 * @param  {Dom Element} el      要增加监听的元素
 * @param  {String}      type    监听的事件类型
 * @param  {Function}    fn      触发的回调函数
 * @param  {Boolean}     capture 在事件什么阶段触发毁掉函数
 * @return {null}
 */
_.removeEvent = (el, type, fn, capture) => {
  el.removeEventListener(type, fn, !!capture)
}

// 处理windows下的触摸
/**
 * 处理windows下的触摸时间
 * @param  {String} pointerEvent 触摸事件
 * @return {Sgring}              处理后的触摸事件
 */
_.prefixPointerEvent = pointerEvent =>
  (window.MSPointerEvent ? `MSPointer${ pointerEvent.charAt(7).toUpperCase() }${ pointerEvent.substr(8) }` : pointerEvent)

/**
 * 处理移动惯性
 * @param  {Number} current      当前位置
 * @param  {Number} start        开始位置
 * @param  {Number} time         时间
 * @param  {Number} lowerMargin  可移动的最大距离
 * @param  {Number} wrapperSize  边界距离
 * @param  {Number} deceleration 减速的加速度
 * @return {Object}              到达位置和时间
 */
_.momentum = (current, start, time, lowerMargin, wrapperSize, deceleration) => {
  let distance = current - start

  const speed = Math.abs(distance) / time

  deceleration = deceleration === undefined ? 0.0006 : deceleration

  let destination = current + (speed * speed) / (2 * deceleration) * (distance < 0 ? -1 : 1)

  let duration = speed / deceleration

  if (destination < lowerMargin) {
    destination = wrapperSize ? lowerMargin - (wrapperSize / 2.5 * (speed / 8)) : lowerMargin
    distance = Math.abs(destination - current)
    duration = distance / speed
  } else if (destination > 0) {
    destination = wrapperSize ? wrapperSize / 2.5 * (speed / 8) : 0
    distance = Math.abs(current) + destination
    duration = distance / speed
  }

  return {
    destination: Math.round(destination),
    duration
  }
}

/**
 * transform的样式名
 */
const _transform = _prefixStyle('transform')

/**
 * 环境检测
 */
_.extend(_, {
  hasTransform: _transform in _elementStyle,
  hasPerspective: _prefixStyle('perspective') in _elementStyle,
  hasTransition: _prefixStyle('transition') in _elementStyle,
  hasTouch: 'ontouchstart' in window,
  hasPointer: !!(window.PointerEvent || window.MSPointerEvent) // 后者是IE10
})

/**
 * 检测不能使用的设备
 * 包括所有低于 build 535.19 的所有浏览器以及 webview
 * - galaxy S2 is ok
 *   -- 2.3.6 : `AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1`
 *   -- 4.0.4 : `AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30`
 * - galaxy S3 is badAndroid (stock brower, webview)
 *  `AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30`
 * - galaxy S4 is badAndroid (stock brower, webview)
 *   `AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30`
 * - galaxy S5 is OK
 *   `AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36 (Chrome/)`
 * - galaxy S6 is OK
 *   `AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36 (Chrome/)`
 */
_.isBadAndroid = (() => {
  const appVersion = window.navigator.appVersion

  // Android浏览器并不是chrome浏览器
  if (/Android/.test(appVersion) && !(/Chrome\/\d/.test(appVersion))) {
    const safariVersion = appVersion.match(/Safari\/(\d+.\d)/)
    if (safariVersion && typeof safariVersion === 'object' && safariVersion.length >= 2) {
      return parseFloat(safariVersion[1]) < 535.19
    }
    return true
  }
  return false
})()

/**
 * 扩展样式
 */
_.extend(_.style = {}, {
  transform: _transform,
  transitionTimingFunction: _prefixStyle('transitionTimingFunction'),
  transitionDuration: _prefixStyle('transitionDuration'),
  transitionDelay: _prefixStyle('transitionDelay'),
  transformOrigin: _prefixStyle('transformOrigin')
})

/**
 * 判断是否支持classList
 */
const _hasClassList = document.createElement('div').classList !== undefined

/**
 * 判断元素是否有某个类
 * @param  {Dom Element} e 要查询的元素
 * @param  {String}      c 要查询的类名
 * @return {Boolean}       是否包含
 */
_.hasClass = (e, c) =>
  (_hasClassList ? e.classList.contains(c) : (new RegExp(`(^|\\s)${ c }($|\\s)`)).test(e.className))

/**
 * 为某个元素增加类，为了删除无用的空格，最后多做了一步
 * @param  {Dom Element} e  要增加类的元素
 * @param  {...String}   cs 要增加的类名
 */
_.addClass = (e, ...cs) =>
  (!_hasClassList ? e.classList.add(...cs) : (cs.forEach(c => (
    e.className += e.className.indexOf(c) === -1 ? ` ${ c }` : ''
  )) || _.removeClass(e, '')))

/**
 * 为某个元素删除类
 * @param  {Dom Element} e 要删除类的元素
 * @param  {...String}   c 要删除的类名
 */
_.removeClass = (e, ...cs) =>
  (!_hasClassList ? e.classList.remove(...cs) : (e.className = e
    .className
    .split(/\s+/)
    .filter(a => cs.indexOf(a) === -1)
    .join(' ')))

/**
 * 获取元素距离页面的距离
 * @param  {Dom Element} el 要判断的元素
 * @return {Object}         元素距离页面的左边距和上边距
 */
_.offset = (el) => {
  let left
  let top

  do {
    left = -el.offsetLeft
    top = -el.offsetTop
    el = el.offsetParent
  } while (el)

  return {
    left,
    top
  }
}

/**
 * 判断符合条件的元素的默认行为
 * @param  {Dom Element} el         要阻止的元素
 * @param  {Object}      exceptions 条件
 * @return {Boolean}
 */
_.preventDefaultException = (el, exceptions) => {
  const keys = Object.keys(exceptions)
  const l = keys.length
  for (let i = 0; i < l; i++) {
    if (exceptions[keys[i]].test(el[i])) {
      return true
    }
  }

  return false
}

/**
 * 扩展事件类型
 */
_.extend(_.eventType = {}, {
  touchstart: 1,
  touchmove: 1,
  touchend: 1,

  mousedown: 2,
  mousemove: 2,
  mouseup: 2,

  pointerdown: 3,
  pointermove: 3,
  pointerup: 3,

  MSPointerDown: 3,
  MSPointerMove: 3,
  MSPointerUp: 3
})

/**
 * 扩展动画
 * style供css使用
 * fn供js使用
 */
_.extend(_.ease = {}, {
  quadratic: {
    style: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    fn(k) {
      return k * (2 - k)
    }
  },

  circular: {
    style: 'cubic-bezier(0.1, 0.57, 0.1, 1)',
    fn(k) {
      return Math.sqrt(1 - (--k * k))
    }
  },

  back: {
    style: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    fn(k) {
      const b = 4
      return --k * k * ((b + 1) * k + b) + 1
    }
  },

  bounce: {
    style: '',
    fn(k) {
      k /= 1
      if (k < (1 / 2.75)) {
        return 7.5625 * k * k
      } else if (k < (2 / 2.75)) {
        return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75
      } else if (k < (2.5 / 2.75)) {
        return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375
      }
      return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375
    }
  },

  elastic: {
    style: '',
    fn(k) {
      const f = 0.22
      const e = 0.4
      if (k === 0) {
        return 0
      } else if (Number(k) === 1) {
        return 1
      }
      return (e * Math.pow(2, -10 * k) * Math.sin((k - f / 4) * (2 * Math.PI) / f) + 1)
    }
  }
})

/**
 * 模拟tap事件
 * @param  {Dom Element} e         要模拟事件的元素
 * @param  {String}      eventName 事件名
 */
_.tap = (e, eventName) => {
  const ev = document.createEvent('Event')

  ev.initEvent(eventName, true, true)
  ev.pageX = e.pageX
  ev.pageY = e.pageY
  e.target.dispatchEvent(ev)
}

/**
 * 模拟click事件
 * @param  {Dom Element} e 要模拟事件的元素
 */
_.click = (e) => {
  const target = e.target

  if (!(/(SELECT|INPUT|TEXTAREA)/i).test(target.tagName)) {
    const ev = document.createEvent(window.MouseEvent ? 'MouseEvents' : 'Event')
    ev.initEvent('click', true, true)
    ev.view = e.view || window
    ev.detail = 1
    ev.screenX = target.screenX || 0
    ev.screenY = target.screenY || 0
    ev.clientX = target.clientX || 0
    ev.clientY = target.clientY || 0
    ev.ctrlKey = !!e.ctrlKey
    ev.altKey = !!e.altKey
    ev.shiftKey = !!e.shiftKey
    ev.metaKey = !!e.metaKey
    ev.button = 0
    ev.relatedTarget = null
    ev._constructed = true
    target.dispatchEvent(ev)
  }
}

_.getRect = (el) => {
  if (el instanceof SVGElement) {
    const rect = el.getBoundingClientRect()
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    }
  }
  console.log(window.getComputedStyle(el).height)
  return {
    top: el.offsetTop,
    left: el.offsetLeft,
    width: el.offsetWidth,
    height: el.offsetHeight
  }
}

export default _
