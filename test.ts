// tests go here; this will not be compiled when this package is used as a library
VL53L0X.init()
basic.forever(function () {
    basic.showNumber(VL53L0X.readSingleDistance())
    basic.showString(VL53L0X.stringDistance())
    basic.pause(500)
})
