let intervalid = -1 // TODO: wat
let canvas = document.getElementById('canvas')
let ctx = $('#canvas')[0].getContext('2d')
let id = ctx.getImageData(0, 0, 1, 1)
let cw = canvas.width
let ch = canvas.height

// stats
let hasHotspot
let hasntHotspot
let avgHotspots
let avgClients

const RED_CHAN = 0
const GREEN_CHAN = 1
const BLUE_CHAN = 2
const ALPHA_CHAN = 3

const WIFI_LINK = 0
const BT_LINK = 1

const BT_RANGE = 10

const WIFI_ENERGY = 1
const BT_ENERGY = 1

/**
* Store connection info of a link between two devices.
* There is no distinction between the two devices.
*/
class Link {
  constructor (left, right, type, delay, energy, cost) {
    this.left = left
    this.right = right
    this.type = type
    this.delay = delay
    this.energy = energy
    this.cost = cost
  }
}

class EnergyLink extends Link {
  constructor (left, right, type, energy) {
    super(left, right, type, 0, energy, 0)
  }
}

/**
* The simulator engine.
*/
class Simulator {
  generate (width, height, count, hotspotFraction, hotspotRange) {
    console.log('generating')

    if (intervalid !== -1) {
      clearInterval(intervalid)
    }

    this.width = width
    this.height = height
    this.count = count
    this.wifiHotspotFraction = hotspotFraction
    this.wifiHotspotRange = hotspotRange

    this.devices = []
    this.wifiConnections = []
    this.btConnections = []

    let counter = 0
    while (counter < this.count) {
      let device = {}
      let x = Math.floor(Math.random() * cw) // TODO: globals
      let y = Math.floor(Math.random() * ch)
      device.dx = 0
      device.dy = 0
      device.x = x
      device.y = y
      device.range = Math.floor(Math.random() * hotspotRange) + (2 / 3 * hotspotRange)
      if (Math.floor(Math.random() * 100) < hotspotFraction) {
        device.hotspot = true
      }
      this.devices[counter] = device
      counter++
    }
  }

  run (continuous) {
    if (continuous === false) {
      this.frame()
    } else {
      intervalid = setInterval(this.frame.bind(this), 100)
    }
  }

  pause (continuous) {
    clearInterval(intervalid)
  }

  frame () {
    this.clear()
    this.update()
    this.draw()
  }

  clear () {
    ctx.clearRect(0, 0, cw, ch)
  }

  update () {
    let counter = 0
    while (counter < this.devices.length) {
      let device = this.devices[counter]

      this.moveDevice(device)
      this.boundDevice(device)

      counter++
    }
    this.updateLinks()
    this.updateBTLinks()
  }

  draw () {
    let counter = 0
    while (counter < this.devices.length) {
      this.drawDevice(this.devices[counter])
      counter++
    }
    this.drawLinks()
    this.computeStats()
  }

  moveDevice (device) {
    let xStep = (Math.random() * 0.2) - 0.1
    let yStep = (Math.random() * 0.2) - 0.1

    device.dx += xStep
    device.dy += yStep

    device.x += device.dx
    device.y += device.dy
  }

  boundDevice (device) {
    if (device.x < 0) {
      device.x = 0
      device.dx *= -1
    }

    if (device.y < 0) {
      device.dy *= -1
      device.y = 0
    }

    if (device.x > cw) {
      device.dx *= -1
      device.x = cw
    }

    if (device.y > ch) {
      device.dy *= -1
      device.y = ch
    }
  }

  getHotspots (device) {
    let index = 0
    let hotspots = []

    let counter = 0
    while (counter < this.devices.length) {
      if (this.devices[counter].hotspot === true) {
        let distance = Math.sqrt(Math.pow(this.devices[counter].x - device.x, 2) + Math.pow(this.devices[counter].y - device.y, 2))
        if (distance < this.devices[counter].range) {
          hotspots[index] = this.devices[counter]
          index++
        }
      }
      counter++
    }
    return hotspots
  }

  getClients (device) {
    let index = 0
    let clients = []

    let counter = 0
    while (counter < this.devices.length) {
      let distance = Math.sqrt(Math.pow(this.devices[counter].x - device.x, 2) + Math.pow(this.devices[counter].y - device.y, 2))
      if (distance < this.devices[counter].range) {
        clients[index] = this.devices[counter]
        index++
      }
      counter++
    }
    return clients
  }

  drawDevice (device) {
    id.data[RED_CHAN] = 0
    id.data[GREEN_CHAN] = 0
    id.data[BLUE_CHAN] = 0
    id.data[ALPHA_CHAN] = 255

    ctx.putImageData(id, device.x, device.y)
    if (device.hotspot === true) {
      ctx.fillStyle = 'rgba(255, 10, 10, .2)'
      ctx.beginPath()
      ctx.arc(device.x, device.y, device.range, 0, Math.PI * 2, true)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = 'rgba(10, 10, 255, .2)'
    ctx.beginPath()
    ctx.arc(device.x, device.y, BT_RANGE, 0, Math.PI * 2, true)
    ctx.closePath()
    ctx.fill()
  }

  updateLinks () {
    this.wifiConnections = []
    for (let counterLeft in this.devices) {
      let deviceLeft = this.devices[counterLeft]
      let hotspots = this.getHotspots(deviceLeft)
      for (let counterRight in hotspots) {
        let deviceRight = hotspots[counterRight]
        this.wifiConnections.push(new EnergyLink(
          deviceLeft, deviceRight, WIFI_LINK, WIFI_ENERGY
        ))
      }
    }
  }

  updateBTLinks () {
    this.btConnections = []
    for (let counterLeft = 0; counterLeft < this.devices.length; counterLeft++) {
      let deviceLeft = this.devices[counterLeft]
      for (let counterRight = counterLeft + 1; counterRight < this.devices.length; counterRight++) {
        let deviceRight = this.devices[counterRight]
        let distance = Math.sqrt(Math.pow(deviceLeft.x - deviceRight.x, 2) + Math.pow(deviceLeft.y - deviceRight.y, 2))
        if (distance < BT_RANGE) {
          this.btConnections.push(new EnergyLink(
            deviceLeft, deviceRight, BT_LINK, BT_ENERGY
          ))
        }
      }
    }
  }

  drawLinks () {
    for (let counter in this.wifiConnections) {
      let link = this.wifiConnections[counter]
      ctx.strokeStyle = 'rgba(150, 10, 10, 1)'
      ctx.beginPath()
      ctx.moveTo(link.left.x, link.left.y)
      ctx.lineTo(link.right.x, link.right.y)
      ctx.stroke()
    }
    for (let counter in this.btConnections) {
      let link = this.btConnections[counter]
      ctx.strokeStyle = 'rgba(10, 10, 200, 1)'
      ctx.beginPath()
      ctx.moveTo(link.left.x, link.left.y)
      ctx.lineTo(link.right.x, link.right.y)
      ctx.stroke()
    }
  }

  computeStats () {
    hasHotspot = 0
    hasntHotspot = 0
    avgHotspots = 0
    avgClients = 0
    let counter = 0
    let totalHotspots = 0
    let device = this.devices[0]
    while (counter < this.devices.length) {
      device = this.devices[counter]
      let hotspots = this.getHotspots(device)
      if (hotspots.length === 0) {
        hasntHotspot++
      } else {
        hasHotspot++
      }
      avgHotspots += hotspots.length
      counter++

      if (device.hotspot === true) {
        totalHotspots++
        let clients = this.getClients(device)
        avgClients += clients.length
      }
    }
    $('#status').text('DENSITY (pp/sq. km): ' + this.count + ' AP%: ' + this.wifiHotspotFraction + ' COVERAGE: (m):' + this.wifiHotspotRange + ' COVERAGE: ' + ((hasHotspot / this.count) * 100).toFixed(2) + '% AVG HOTSPOTS: ' + (avgHotspots / hasHotspot).toFixed(2) + ' AVG CLIENTS: ' + (avgClients / totalHotspots).toFixed(2))
  }
}

let sim = new Simulator()

// Characteristicis of Canada
function canada () {
  $('#density').val('4')
  if (intervalid !== -1) { clearInterval(intervalid) }
}

// Characteristicis of Guatamala City
function guatcity () {
  $('#density').val('1000')
  if (intervalid !== -1) { clearInterval(intervalid) }
}

// Characteristicis of Toronto
function tor () {
  $('#density').val('2650')
  if (intervalid !== -1) { clearInterval(intervalid) }
}

// Characteristic=is of Vancouver
function van () {
  $('#density').val('5249')
  if (intervalid !== -1) { clearInterval(intervalid) }
}
