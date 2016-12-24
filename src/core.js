import utils from './utils'
import pkg from '../package.json'

export default class IScroll {
  static version = pkg.version
  static utils = utils

  /**
   * 构造函数
   * @param  {Dom Elment} el      要应用的元素
   * @param  {Object}     options 配置
   * @return {Object}             IScroll实例
   */
  constructor(el, options) {
    this.wrapper = typeof el === 'string' ? document.querySelector(el) : el

    // 第一个子元素
    this.scroller = this.wrapper.children[0]

    this.scrollerStyle = this.scroller.style

    this.options = {
      disablePointer: !utils.hasPointer,
      disableTouch: utils.hasPointer || !utils.hasTouch,
      disbaleMouse: utils.hasPointer || utils.hasTouch,

      startX: 0,
      startY: 0,
      scrollY: true,

      directionLockThreshold: 5,
      momentum: true,

      bounce: true,
      bounceTime: 600,
      bounceEasing: '',

      preventDefault: true,
      preventDefaultException: {
        tagName: /^(INPUT|TEXTAREA|BUTTON|SELECT)$/
      },

      HWCompositing: true,
      useTransition: true,
      useTransform: true,
      bindToWrapper: typeof window.onmousedown === 'undefined'
    }

    utils.extend(this.options, options)

    // 开启GPU硬件加速
    this.translateZ = this.options.HWCompositing && utils.hasPerspective ? ' translateZ(0)' : ''

    this.options.useTransition = utils.hasTransition && this.options.useTransition
    this.options.useTransform = utils.hasTransform && this.options.useTransform

    this.options.eventPassthrough = this.options.eventPassthrough === true ? 'vertical' : this.options.eventPassthrough
    this.options.preventDefault = !this.options.eventPassthrough && this.options.preventDefault

    // 锁定某个方向的滚动
    this.options.scrollY = this.options.eventPassthrough === 'vertical' ? false : this.options.scrollY
    this.options.scrollX = this.options.eventPassthrough === 'horizontal' ? false : this.options.scrollX

    this.options.freeScroll = this.options.freeScroll && !this.options.eventPassthrough
    this.options.directionLockThreshold =
      this.options.eventPassthrough ? 0 : this.options.directionLockThreshold

    this.options.bounceEasing = typeof this.options.bounceEasing === 'string' ? utils.ease[this.options.bounceEasing] || utils.ease.circular : this.options.bounceEasing

    this.options.resizePolling =
      this.options.resizePolling === undefined ? 60 : this.options.resizePolling

    if (this.options.tap === true) {
      this.options.tap = 'tap'
    }

    // https://github.com/cubiq/iscroll/issues/1029
    if (!this.options.useTransition && !this.options.useTransform) {
      if (!(/relative|absolute/i).test(this.scrollerStyle.position)) {
        this.scrollerStyle.position = 'relative'
      }
    }

    this.x = 0
    this.y = 0
    this.directionX = 0
    this.directionY = 0
    this._events = {}

    this._init()
    this.refresh()

    this.scrollTo(this.options.startX, this.options.startY)
    this.enable()
  }

  /**
   * 初始化
   */
  _init() {
    this._initEvents()
  }

  /**
   * 销毁
   */
  destroy() {
    this._initEvents(true)
    clearTimeout(this.resizeTimeout)
    this.resizeTimeout = null
    this._execEvent('destroy')
  }

  /**
   * 动画结束处理
   * @param  {Event} e 事件
   */
  _transitionEnd(e) {
    if (e.target !== this.scroller || !this.isInTransition) {
      return
    }

    this._transitionTime()

    if (!this.resetPosition(this.options.bounceTime)) {
      this.isInTransition = false
      this._execEvent('scrollEnd')
    }
  }

  /**
   * 滑动开始事件的处理，包括鼠标左键以及触摸
   * @param  {Event} e 要处理的事件
   */
  _start(e) {
    // 鼠标左键的相关事件
    if (utils.eventType[e.type] !== 1) {
      let button

      if (!e.which) {
        // 处理 IE
        if (e.button < 2) {
          button = 0
        } else if (e.button === 4) {
          button = 1
        } else {
          button = 2
        }
      } else {
        button = e.button
      }

      if (button !== 0) {
        return
      }
    }

    if (!this.enabled || (this.initiated && utils.eventType[e.type] !== this.initiated)) {
      return
    }

    if (!this.options.preventDefault &&
      !utils.isBadAndroid &&
      !utils.preventDefaultException(e.target, this.options.preventDefaultException)) {
      e.preventDefault()
    }

    const point = e.touches ? e.touches[0] : e

    this.initiated = utils.eventType[e.type]
    this.moved = false
    this.distX = 0
    this.distY = 0
    this.directionX = 0
    this.directionY = 0
    this.directionLocked = 0

    // 动画开始时间
    this.startTime = utils.getTime()

    if (this.options.useTransition && this.isInTransition) {
      // 如果正在css动画中，停止动画
      this._transitionTime()
      this.isInTransition = false

      // 位置是当前位置
      const pos = this.getComputedPosition()
      this._translate(Math.round(pos.x), Math.round(pos.y))

      // 触发 滚动结束 事件
      this._execEvent('scrollEnd')
    } else if (!this.options.useTransition && this.isAnimating) {
      // js动画中，也停止
      this.isAnimating = false
      this._execEvent('scrollEnd')
    }

    // 重置参数
    this.startX = this.x
    this.startY = this.y
    this.absStartX = this.x
    this.absStartY = this.y
    this.pointX = point.pageX
    this.pointY = point.pageY

    // 触发 滚动开始前 事件
    this._execEvent('beforeScrollStart')
  }

  /**
   * 滑动过程中事件的处理
   * @param  {Event} e 要处理的事件
   */
  _move(e) {
    // 不允许拖动或者未初始化则直接返回
    if (!this.enabled || utils.eventType[e.type] !== this.initiated) {
      return
    }

    if (this.options.preventDefault) {
      e.preventDefault()
    }

    const point = e.touches ? e.touches[0] : e
    let deltaX = point.pageX - this.pointX
    let deltaY = point.pageY - this.pointY
    const timestamp = utils.getTime()

    this.pointX = point.pageX
    this.pointY = point.pageY

    this.distX += deltaX
    this.distY += deltaY

    const absDistX = Math.abs(this.distX)
    const absDistY = Math.abs(this.distY)

    // 少于300毫秒，或者移动距离小于10px的都不滑动
    if (timestamp - this.endTime > 300 && (absDistX < 10 && absDistY < 10)) {
      return
    }

    // 锁定滑动方向
    if (!this.directionLocked && !this.options.freeScroll) {
      if (absDistX > absDistY + this.options.directionLockThreshold) {
        // 锁定为水平滑动
        this.directionLocked = 'h'
      } else if (absDistY >= absDistX + this.options.directionLockThreshold) {
        // 锁定为垂直滑动
        this.directionLocked = 'v'
      } else {
        // 不锁定
        this.directionLocked = 'n'
      }
    }

    if (this.directionLocked === 'h') {
      if (this.options.eventPassthrough === 'vertical') {
        e.preventDefault()
      } else if (this.options.eventPassthrough === 'horizontal') {
        this.initiated = false
        return
      }

      deltaY = 0
    } else if (this.directionLocked === 'v') {
      if (this.options.eventPassthrough === 'horizontal') {
        e.preventDefault()
      } else if (this.options.eventPassthrough === 'vertical') {
        this.initiated = false
        return
      }

      deltaX = 0
    }

    deltaX = this.hasHorizontalScroll ? deltaX : 0
    deltaY = this.hasVerticalScroll ? deltaY : 0

    let newX = this.x + deltaX
    let newY = this.y + deltaY

    // 滑动超出边界的话，减慢滑动速度
    if (newX > 0 || newX < this.maxScrollX) {
      if (this.options.bounce) {
        newX = this.x + deltaX / 3
      } else {
        newX = newX > 0 ? 0 : this.maxScrollX
      }
    }

    if (newY > 0 || newY < this.maxScrollY) {
      if (this.options.bounce) {
        newY = this.y + deltaY / 3
      } else {
        newY = newY > 0 ? 0 : this.maxScrollY
      }
    }

    if (deltaX > 0) {
      this.directionX = 1
    } else if (deltaX < 0) {
      this.directionX = -1
    } else {
      this.directionX = 0
    }

    if (deltaY > 0) {
      this.directionY = 1
    } else if (deltaX < 0) {
      this.directionY = -1
    } else {
      this.directionY = 0
    }

    // 触发 滚动开始 事件
    if (!this.moved) {
      this._execEvent('scrollStart')
    }

    this.moved = true
    this._translate(newX, newY)

    if (timestamp - this.startTime > 300) {
      this.startTime = timestamp
      this.startX = this.x
      this.startY = this.y
    }
  }

  /**
   * 滑动结束事件的处理
   * @param  {Event} e 要处理的事件
   */
  _end(e) {
    if (!this.enabled || utils.eventType[e.type] !== this.initiated) {
      return
    }

    if (this.options.preventDefault &&
      !utils.preventDefaultException(e.target, this.options.preventDefaultException)) {
      e.preventDefault()
    }

    const duration = utils.getTime() - this.startTime

    let newX = Math.round(this.x)
    let newY = Math.round(this.y)

    const distanceX = Math.abs(newX - this.startX)
    const distanceY = Math.abs(newY - this.startY)

    let time = 0
    let easing = ''

    this.isInTransition = 0
    this.initiated = 0
    this.endTime = utils.getTime()

    // 边界外的话重置位置，不执行后面的逻辑
    if (this.resetPosition(this.options.bounceTime)) {
      return
    }

    // 移动到目标位置，来确保结束位置是整数
    this.scrollTo(newX, newY)

    // 如果移动不满足滑动的情况，小于10px
    if (!this.moved) {
      if (this.options.tap) {
        // 模拟tap
        utils.tap(e, this.options.tap)
      }

      if (this.options.click) {
        // 模拟click
        utils.click(e)
      }

      // 触发 滚动取消 事件
      this._execEvent('scrollCancel')
      return
    }

    // flick事件
    if (this._events.flick &&
      duration < 200 &&
      distanceX < 100 &&
      distanceY < 100) {
      this._execEvent('flick')
      return
    }

    // 按需开始惯性动画
    if (this.options.momentum && duration < 300) {
      let momentumX = {
        destination: newX,
        duration: 0
      }
      if (this.hasHorizontalScroll) {
        momentumX = utils.momentum(
          this.x,
          this.startX,
          duration,
          this.maxScrollX,
          this.options.bounce ? this.wrapperWidth : 0)
      }

      let momentumY = {
        destination: newY,
        duration: 0
      }
      if (this.hasVerticalScroll) {
        momentumY = utils.momentum(
          this.y,
          this.startY,
          duration,
          this.maxScrollY,
          this.options.bounce ? this.wrapperHeight : 0)
      }

      newX = momentumX.destination
      newY = momentumY.destination

      time = Math.max(momentumX.duration, momentumY.duration)
      this.isInTransition = 1
    }

    if ((newX !== this.x) || (newY !== this.y)) {
      if ((newX > 0) || (newX < this.maxScrollX) || (newY > 0) || (newY < this.maxScrollY)) {
        easing = utils.ease.quadratic
      }

      this.scrollTo(newX, newY, time, easing)
      return
    }

    this._execEvent('scrollEnd')
  }

  /**
   * 恢复
   */
  _resize() {
    clearTimeout(this.resizeTimeout)

    this.resizeTimeout = setTimeout(() => {
      this.refresh()
    }, this.options.resizePolling)
  }

  /**
   * 恢复位置
   * @param  {Number} time [description]
   * @return {[type]}      [description]
   */
  resetPosition(time) {
    let {
      x,
      y
    } = this

    time = time || 0

    if (!this.hasHorizontalScroll || x > 0) {
      x = 0
    } else
    if (x < this.maxScrollX) {
      x = this.maxScrollX
    }

    if (!this.hasVerticalScroll || y > 0) {
      y = 0
    } else if (y < this.maxScrollY) {
      y = this.maxScrollY
    }

    if (x === this.x && y === this.y) {
      return false
    }

    this.scrollTo(x, y, time, this.options.bounceEasing)

    return true
  }

  /**
   * 禁用iscroll
   */
  disbale() {
    this.enabled = false
  }

  /**
   * 开启iscroll
   */
  enable() {
    this.enabled = true
  }

  /**
   * 更新iscroll的基础信息
   */
  refresh() {
    utils.getRect(this.wrapper) // Force reflow

    this.wrapperWidth = this.wrapper.clientWidth
    this.wrapperHeight = this.wrapper.clientHeight

    const rect = utils.getRect(this.scroller)
    console.log(rect)

    this.scrollerWidth = rect.width
    this.scrollerHeight = rect.height

    this.maxScrollX = this.wrapperWidth - this.scrollerWidth
    this.maxScrollY = this.wrapperHeight - this.scrollerHeight

    this.hasHorizontalScroll = this.options.scrollX && this.maxScrollX < 0
    this.hasVerticalScroll = this.options.scrollY && this.maxScrollY < 0

    if (!this.hasHorizontalScroll) {
      this.maxScrollX = 0
      this.scrollerWidth = this.wrapperWidth
    }

    if (!this.hasVerticalScroll) {
      this.maxScrollY = 0
      this.scrollerHeight = this.wrapperHeight
    }

    this.endTime = 0
    this.directionX = 0
    this.directionY = 0

    this.wrapperOffset = utils.offset(this.wrapper)

    this._execEvent('refresh')
    this.resetPosition()
  }

  /**
   * 增加事件监听的回调函数
   * @param  {String}   type 事件类型
   * @param  {Function} fn   回调函数
   */
  on(type, fn) {
    if (!this._events[type]) {
      this._events[type] = []
    }

    this._events[type].push(fn)
  }

  /**
   * 移除事件监听的回调函数
   * @param  {String}   type 事件类型
   * @param  {Function} fn   回调函数
   */
  off(type, fn) {
    if (!this._events[type]) {
      return
    }

    const index = this._events[type].indexOf(fn)

    if (index > -1) {
      this._events[type].splice(index, 1)
    }
  }

  /**
   * 执行事件监听的回调函数
   * @param  {String} type 事件类型
   * @param  {...*}   args 毁掉函数的参数
   */
  _execEvent(type, ...args) {
    if (!this._events[type]) {
      return
    }

    this
      ._events[type]
      .forEach((fn) => {
        fn.apply(this, args)
      })
  }

  /**
   * 滑动一定的距离
   * @param  {Number} x      移动的水平像素
   * @param  {Number} y      移动的水平像素
   * @param  {Number} time   移动时间
   * @param  {Object} easing 移动动画效果
   */
  scrollBy(x, y, time, easing) {
    x = this.x + x
    y = this.y + y

    time = time || 0

    this.scrollTo(x, y, time, easing)
  }

  /**
   * 滑动到某个位置
   * @param  {Number} x      要移动到的水平位置
   * @param  {Number} y      要移动到的垂直位置
   * @param  {Number} time   移动时间
   * @param  {Object} easing 移动动画效果
   */
  scrollTo(x, y, time, easing) {
    easing = easing || utils.ease.circular

    this.isInTransition = this.options.useTransition && time > 0
    const transitionType = this.options.useTransition && easing.style

    if (!time || transitionType) {
      if (transitionType) {
        this._transitionTimingFunction(easing.style)
        this._transitionTime(time)
      }
      this._translate(x, y)
    } else {
      console.log(easing)
      this._animate(x, y, time, easing.fn)
    }
  }

  /**
   * 滚动到某个元素
   * @param  {Dom Element} el      要滚动到的元素
   * @param  {Number}      time    滚动时间
   * @param  {Boolean}     offsetX 是否有水平偏移
   * @param  {Boolean}     offsetY 是否有垂直偏移
   * @param  {Object}      easing  动画效果
   */
  scrollToElement(el, time, offsetX, offsetY, easing) {
    el = el.nodeType ? el : this.scroller.querySelector(el)

    if (!el) {
      return
    }

    const pos = utils.offset(el)

    pos.left -= this.wrapperOffset.left
    pos.top -= this.wrapperOffset.top

    const elRect = utils.getRects(el)
    const wrapperRect = utils.getRect(this.wrapper)

    // offsetX为true则水平居中
    if (offsetX === true) {
      offsetX = Math.round(elRect.width / 2 - wrapperRect.width / 2)
    }

    // offsetY为true则垂直居中
    if (offsetY === true) {
      offsetY = Math.round(elRect.height / 2 - wrapperRect.height / 2)
    }

    pos.left -= offsetX || 0
    pos.top -= offsetY || 0

    if (pos.left > 0) {
      pos.left = 0
    } else if (pos.left < this.maxScrollX) {
      pos.left = this.maxScrollX
    }

    if (pos.top > 0) {
      pos.top = 0
    } else if (pos.top < this.maxScrollY) {
      pos.top = this.maxScrollY
    }

    time =
      time === undefined ||
      time === null ||
      (time === 'auto' ?
        Math.max(Math.abs(this.x - pos.left), Math.abs(this.y - pos.top)) : time)

    console.log(easing)
    this.scrollTo(pos.left, pos.top, time, easing)
  }

  /**
   * 动画时间
   * @param  {Number} time 动画时间
   */
  _transitionTime(time) {
    time = time || 0

    if (!this.options.useTransition) {
      return
    }

    const durationProp = utils.style.transitionDuration

    if (!durationProp) {
      return
    }

    this.scrollerStyle[durationProp] = `${ time }ms`

    // 增加 transiton-duration
    if (!time && utils.isBadAndroid) {
      this.scrollerStyle[durationProp] = '0.0001ms'
        // 移除 0.0001ms
      utils.rAF(() => {
        if (self.scrollerStyle[durationProp] === '0.0001ms') {
          self.scrollerStyle[durationProp] = '0s'
        }
      })
    }
  }

  /**
   * 移动时间函数
   * @param  {Object} easing 动画效果
   */
  _transitionTimingFunction(easing) {
    this.scrollerStyle[utils.style.transitionTimingFunction] = easing
  }

  /**
   * 移动
   * @param  {Number} x 水平坐标
   * @param  {Number} y 垂直坐标
   */
  _translate(x, y) {
    if (this.options.useTransform) {
      this.scrollerStyle[utils.style.transform] =
        `translate(${ x }px, ${ y }px)${ this.translateZ }`
    } else {
      x = Math.round(x)
      y = Math.round(y)

      this.scrollerStyle.left = `${ x }px`
      this.scrollerStyle.top = `${ y }px`
    }

    this.x = x
    this.y = y
  }

  /**
   * 初始化事件
   * @param  {Boolean} remove 移除或增加事件监听
   */
  _initEvents(remove) {
    const eventType = remove ? utils.removeEvent : utils.addEvent
    const target = this.options.bindToWrapper ? this.wrapper : window

    eventType(window, 'orientationchange', this)
    eventType(window, 'resize', this)

    if (this.options.click) {
      eventType(this.wrapper, 'click', this, true)
    }

    // 滚轮
    if (!this.options.disableMouse) {
      eventType(this.wrapper, 'mousedown', this)
      eventType(target, 'mousemove', this)
      eventType(target, 'mousecancel', this)
      eventType(target, 'mouseup', this)
    }

    // 鼠标
    if (utils.hasPointer && !this.options.disablePointer) {
      eventType(this.wrapper, utils.prefixPointerEvent('pointerdown'), this)
      eventType(target, utils.prefixPointerEvent('pointermove'), this)
      eventType(target, utils.prefixPointerEvent('pointercancel'), this)
      eventType(target, utils.prefixPointerEvent('pointerup'), this)
    }

    // 触摸
    if (utils.hasTouch && !this.options.disableTouch) {
      eventType(this.wrapper, 'touchstart', this)
      eventType(target, 'touchmove', this)
      eventType(target, 'touchcancel', this)
      eventType(target, 'touchend', this)
    }

    // css动画结束
    eventType(this.scroller, 'transitionend', this)
    eventType(this.scroller, 'webkitTransitionEnd', this)
    eventType(this.scroller, 'oTransitionEnd', this)
    eventType(this.scroller, 'MSTransitionEnd', this)
  }

  /**
   * 获取计算后的位置
   * @return {Object} 位置对象
   */
  getComputedPosition() {
    let matrix = window.getComputedStyle(this.scroller, null)
    let x
    let y

    if (this.options.useTransform) {
      matrix = matrix[utils.style.transform].split(')')[0].split(', ')
      x = +(matrix[12] || matrix[4])
      y = +(matrix[13] || matrix[5])
    } else {
      x = +matrix.left.replace(/[^-\d]/g, '')
      y = +matrix.top.replace(/[^-\d]/g, '')
    }

    return {
      x,
      y
    }
  }

  /**
   * 移动动画
   * @param  {Number}}  destX    终点水平坐标
   * @param  {Number}   destY    重点垂直坐标
   * @param  {Number}   duration 动画时间
   * @param  {Function} easingFn 动画函数
   */
  _animate(destX, destY, duration, easingFn) {
    const startX = this.x
    const startY = this.y
    const startTime = utils.getTime()
    const destTime = startTime + duration

    const step = () => {
      let now = utils.getTime()
      if (now >= destTime) {
        this.isAnimating = false
        this._translate(destX, destY)

        if (!this.resetPosition(this.options.bounceTime)) {
          this._execEvent('scrollEnd')
        }

        return
      }

      now = (now - startTime) / duration
      const easing = easingFn(now)
      const newX = (destX - startX) * easing + startX
      const newY = (destY - startY) * easing + startY
      this._translate(newX, newY)

      if (this.isAnimating) {
        utils.rAF(() => {
          step()
        })
      }
    }

    this.isAnimating = true
    step()
  }

  /**
   * 响应事件
   * @param  {Event} e 要响应的事件
   */
  handleEvent(e) {
    switch (e.type) {
      case 'touchstart':
      case 'pointerdown':
      case 'MSPointerDown':
      case 'mousedown':
        this._start(e)
        break
      case 'touchmove':
      case 'pointermove':
      case 'MSPointerMove':
      case 'mousemove':
        this._move(e)
        break
      case 'touchend':
      case 'pointerup':
      case 'MSPointerUp':
      case 'mouseup':
      case 'touchcancel':
      case 'pointercancel':
      case 'MSPointerCancel':
      case 'mousecancel':
        this._end(e)
        break
      case 'orientationchange':
      case 'resize':
        this._resize()
        break
      case 'transitionend':
      case 'webkitTransitionEnd':
      case 'oTransitionEnd':
      case 'MSTransitionEnd':
        this._transitionEnd(e)
        break
      case 'wheel':
      case 'DOMMouseScroll':
      case 'mousewheel':
        this._wheel(e)
        break
      case 'keydown':
        this._key(e)
        break
      case 'click':
        if (this.enabled && !e._constructed) {
          e.preventDefault()
          e.stopPropagation()
        }
        break
      default:
        break
    }
  }

}

export const VERSION = pkg.version
