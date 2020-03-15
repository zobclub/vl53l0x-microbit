# vl53l0x-microbit
---
This extension supports VL53L0X Time-of-Flight ranging sensor in MakeCode
* I2C address 0x29

## Method
---
* Initialize

Always run at the beginning
```
VL53L0X.init()
```
* Get Distance Number
```
VL53L0X.readSingleDistance()
```

* Get Distance String
```
VL53L0X.stringDistance()

```

## Example
---
```
// tests go here; this will not be compiled when this package is used as a library
VL53L0X.init()
basic.forever(function () {
    basic.showNumber(VL53L0X.readSingleDistance())
    basic.showString(VL53L0X.stringDistance())
    basic.pause(500)
})
```

## License
MIT

## Supported targets

* for PXT/microbit

