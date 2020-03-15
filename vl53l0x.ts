/**
* VL53L0X block
*/
//% weight=90 color=#1eb0f0 icon="\uf0b2"
namespace VL53L0X {
    let i2cAddr = 0x29
    let IO_TIMEOUT = 1000
    let SYSRANGE_START = 0x00
    let EXTSUP_HV = 0x89
    let MSRC_CONFIG = 0x60
    let FINAL_RATE_RTN_LIMIT = 0x44
    let SYSTEM_SEQUENCE = 0x01
    let SPAD_REF_START = 0x4f
    let SPAD_ENABLES = 0xb0
    let REF_EN_START_SELECT = 0xb6
    let SPAD_NUM_REQUESTED = 0x4e
    let INTERRUPT_GPIO = 0x0a
    let INTERRUPT_CLEAR = 0x0b
    let GPIO_MUX_ACTIVE_HIGH = 0x84
    let RESULT_INTERRUPT_STATUS = 0x13
    let RESULT_RANGE_STATUS = 0x14
    let OSC_CALIBRATE = 0xf8
    let MEASURE_PERIOD = 0x04

    let started = false
    let stop_variable = 0
    let spad_count = 0
    let is_aperture = false
    let spad_map: number[] = [0, 0, 0, 0, 0, 0]

    function readReg(raddr: number): number {
        pins.i2cWriteNumber(i2cAddr, raddr, NumberFormat.UInt8BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt8BE, false)
        return d;
    }

    function readReg16(raddr: number): number {
        pins.i2cWriteNumber(i2cAddr, raddr, NumberFormat.UInt8BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        return d;
    }

    function writeReg(raddr: number, d: number): void {
        pins.i2cWriteNumber(i2cAddr, ((raddr << 8) + d), NumberFormat.UInt16BE, false)
    }

    function writeReg16(raddr: number, d: number): void {
        pins.i2cWriteNumber(i2cAddr, raddr, NumberFormat.UInt8BE, false)
        pins.i2cWriteNumber(i2cAddr, d, NumberFormat.UInt16BE, false)
    }

    function readFlag(register: number = 0x00, bit: number = 0): number {
        let data = readReg(register)
        let mask = 1 << bit
        return (data & mask)
    }

    function writeFlag(register: number = 0x00, bit: number = 0, onflag: boolean): void {
        let data = readReg(register)
        let mask = 1 << bit
        if (onflag)
            data |= mask
        else
            data &= ~mask
        writeReg(register, data)
    }
    /**
     * VL53L0X Initialize
     */
    //% blockId="VL53L0X_INITIALIZE" block="init vl53l0x"
    export function init(): void {
        let r1 = readReg(0xc0)
        let r2 = readReg(0xc1)
        let r3 = readReg(0xc2)

        if (r1 != 0xEE || r2 != 0xAA || r3 != 0x10) {
            return
        }
        let power2v8 = true
        writeFlag(EXTSUP_HV, 0, power2v8)

        // I2C standard mode
        writeReg(0x88, 0x00)
        writeReg(0x80, 0x01)
        writeReg(0xff, 0x01)
        writeReg(0x00, 0x00)
        stop_variable = readReg(0x91)
        writeReg(0x00, 0x01)
        writeReg(0xff, 0x00)
        writeReg(0x80, 0x00)

        writeFlag(MSRC_CONFIG, 1, true)
        writeFlag(MSRC_CONFIG, 4, true)

        writeReg16(FINAL_RATE_RTN_LIMIT, Math.floor(0.25 * (1 << 7)))

        writeReg(SYSTEM_SEQUENCE, 0xff)

        if (!spad_info())
            return

        pins.i2cWriteNumber(i2cAddr, SPAD_ENABLES, NumberFormat.UInt8BE, false)
        let sp1 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        let sp2 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        let sp3 = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        spad_map[0] = (sp1 >> 8) & 0xFF
        spad_map[1] = sp1 & 0xFF
        spad_map[2] = (sp2 >> 8) & 0xFF
        spad_map[3] = sp2 & 0xFF
        spad_map[4] = (sp3 >> 8) & 0xFF
        spad_map[5] = sp3 & 0xFF

        // set reference spads
        writeReg(0xff, 0x01)
        writeReg(SPAD_REF_START, 0x00)
        writeReg(SPAD_NUM_REQUESTED, 0x2c)
        writeReg(0xff, 0x00)
        writeReg(REF_EN_START_SELECT, 0xb4)

        let spads_enabled = 0
        for (let i = 0; i < 48; i++) {
            if ((i < 12 && is_aperture) || (spads_enabled >= spad_count)) {
                spad_map[i >> 3] &= ~(1 << (i >> 2))
            } else if (spad_map[i >> 3] & (1 << (i >> 2))) {
                spads_enabled += 1
            }
        }

        writeReg(0xff, 0x01)
        writeReg(0x00, 0x00)

        writeReg(0xff, 0x00)
        writeReg(0x09, 0x00)
        writeReg(0x10, 0x00)
        writeReg(0x11, 0x00)

        writeReg(0x24, 0x01)
        writeReg(0x25, 0xFF)
        writeReg(0x75, 0x00)

        writeReg(0xFF, 0x01)
        writeReg(0x4E, 0x2C)
        writeReg(0x48, 0x00)
        writeReg(0x30, 0x20)

        writeReg(0xFF, 0x00)
        writeReg(0x30, 0x09)
        writeReg(0x54, 0x00)
        writeReg(0x31, 0x04)
        writeReg(0x32, 0x03)
        writeReg(0x40, 0x83)
        writeReg(0x46, 0x25)
        writeReg(0x60, 0x00)
        writeReg(0x27, 0x00)
        writeReg(0x50, 0x06)
        writeReg(0x51, 0x00)
        writeReg(0x52, 0x96)
        writeReg(0x56, 0x08)
        writeReg(0x57, 0x30)
        writeReg(0x61, 0x00)
        writeReg(0x62, 0x00)
        writeReg(0x64, 0x00)
        writeReg(0x65, 0x00)
        writeReg(0x66, 0xA0)

        writeReg(0xFF, 0x01)
        writeReg(0x22, 0x32)
        writeReg(0x47, 0x14)
        writeReg(0x49, 0xFF)
        writeReg(0x4A, 0x00)

        writeReg(0xFF, 0x00)
        writeReg(0x7A, 0x0A)
        writeReg(0x7B, 0x00)
        writeReg(0x78, 0x21)

        writeReg(0xFF, 0x01)
        writeReg(0x23, 0x34)
        writeReg(0x42, 0x00)
        writeReg(0x44, 0xFF)
        writeReg(0x45, 0x26)
        writeReg(0x46, 0x05)
        writeReg(0x40, 0x40)
        writeReg(0x0E, 0x06)
        writeReg(0x20, 0x1A)
        writeReg(0x43, 0x40)

        writeReg(0xFF, 0x00)
        writeReg(0x34, 0x03)
        writeReg(0x35, 0x44)

        writeReg(0xFF, 0x01)
        writeReg(0x31, 0x04)
        writeReg(0x4B, 0x09)
        writeReg(0x4C, 0x05)
        writeReg(0x4D, 0x04)

        writeReg(0xFF, 0x00)
        writeReg(0x44, 0x00)
        writeReg(0x45, 0x20)
        writeReg(0x47, 0x08)
        writeReg(0x48, 0x28)
        writeReg(0x67, 0x00)
        writeReg(0x70, 0x04)
        writeReg(0x71, 0x01)
        writeReg(0x72, 0xFE)
        writeReg(0x76, 0x00)
        writeReg(0x77, 0x00)

        writeReg(0xFF, 0x01)
        writeReg(0x0D, 0x01)

        writeReg(0xFF, 0x00)
        writeReg(0x80, 0x01)
        writeReg(0x01, 0xF8)

        writeReg(0xFF, 0x01)
        writeReg(0x8E, 0x01)
        writeReg(0x00, 0x01)
        writeReg(0xFF, 0x00)
        writeReg(0x80, 0x00)

        writeReg(INTERRUPT_GPIO, 0x04)
        writeFlag(GPIO_MUX_ACTIVE_HIGH, 4, false)
        writeReg(INTERRUPT_CLEAR, 0x01)

        writeReg(SYSTEM_SEQUENCE, 0x01)
        if (!calibrate(0x40))
            return
        writeReg(SYSTEM_SEQUENCE, 0x02)
        if (!calibrate(0x00))
            return
        writeReg(SYSTEM_SEQUENCE, 0xe8)

        return
    }

    function spad_info(): boolean {
        writeReg(0x80, 0x01)
        writeReg(0xff, 0x01)
        writeReg(0x00, 0x00)
        writeReg(0xff, 0x06)

        writeFlag(0x83, 3, true)
        writeReg(0xff, 0x07)
        writeReg(0x81, 0x01)
        writeReg(0x80, 0x01)
        writeReg(0x94, 0x6b)
        writeReg(0x83, 0x00)

        let timeout = 0
        while (readReg(0x83) == 0) {
            timeout++
            basic.pause(1)
            if (timeout == IO_TIMEOUT)
                return false
        }

        writeReg(0x83, 0x01)
        let value = readReg(0x92)
        writeReg(0x81, 0x00)
        writeReg(0xff, 0x06)

        writeFlag(0x83, 3, false)

        writeReg(0xff, 0x01)
        writeReg(0x00, 0x01)

        writeReg(0xff, 0x00)
        writeReg(0x80, 0x00)

        spad_count = value & 0x7f
        is_aperture = ((value & 0b10000000) == 0b10000000)
        return true
    }

    function calibrate(val: number): boolean {
        writeReg(SYSRANGE_START, 0x01 | val)
        let timeout = 0
        while ((readReg(RESULT_INTERRUPT_STATUS) & 0x07) == 0) {
            timeout++
            basic.pause(1)
            if (timeout == IO_TIMEOUT)
                return false
        }

        writeReg(INTERRUPT_CLEAR, 0x01)
        writeReg(SYSRANGE_START, 0x00)
        return true
    }

    function startContinous(period: number = 0): void {
        writeReg(0x80, 0x01)
        writeReg(0xFF, 0x01)
        writeReg(0x00, 0x00)
        writeReg(0x91, stop_variable)
        writeReg(0x00, 0x01)
        writeReg(0xFF, 0x00)
        writeReg(0x80, 0x00)
        let oscilator = 0
        if (period)
            oscilator = readReg16(OSC_CALIBRATE)
        if (oscilator) {
            period *= oscilator
            writeReg16(MEASURE_PERIOD, (period >> 16) & 0xffff)
            pins.i2cWriteNumber(i2cAddr, period & 0xffff, NumberFormat.UInt16BE, false)
            writeReg(SYSRANGE_START, 0x04)
        } else {
            writeReg(SYSRANGE_START, 0x02)
        }
        started = true
    }

    function stopContinous(): void {
        writeReg(SYSRANGE_START, 0x01)
        writeReg(0xFF, 0x01)
        writeReg(0x00, 0x00)
        writeReg(0x91, stop_variable)
        writeReg(0x00, 0x01)
        writeReg(0xFF, 0x00)
        started = false
    }

    function readContinousDistance(): number {
        let timeout = 0
        while ((readReg(RESULT_INTERRUPT_STATUS) & 0x07) == 0) {
            timeout++
            basic.pause(1)
            if (timeout == IO_TIMEOUT)
                return 0
        }
        let value = readReg16(RESULT_RANGE_STATUS + 10)
        writeReg(INTERRUPT_CLEAR, 0x01)
        return value
    }

    /**
     * Read Distance
     */
    //% blockId="VL53L0X_DISTANCE" block="distance"
    export function readSingleDistance(): number {
        let timeout = 0
        if (!started) {
            writeReg(0x80, 0x01)
            writeReg(0xFF, 0x01)
            writeReg(0x00, 0x00)
            writeReg(0x91, stop_variable)
            writeReg(0x00, 0x01)
            writeReg(0xFF, 0x00)
            writeReg(0x80, 0x00)
            writeReg(SYSRANGE_START, 0x01)
            while (readReg(SYSRANGE_START) & 0x01) {
                timeout++
                basic.pause(1)
                if (timeout == IO_TIMEOUT)
                    return 0
            }
        }

        timeout = 0
        while ((readReg(RESULT_INTERRUPT_STATUS) & 0x07) == 0) {
            timeout++
            basic.pause(1)
            if (timeout == IO_TIMEOUT)
                return 0
        }

        let value = readReg16(RESULT_RANGE_STATUS + 10)
        writeReg(INTERRUPT_CLEAR, 0x01)
        return value
    }
    //% blockId="STRING_DISTANCE" block="s_distance"
    export function stringDistance(): string {
        let d = readSingleDistance()
        let d1 = Math.floor(d / 10)
        let d2 = Math.floor(d - (d1 * 10))
        let s = `${d1}` + '.' + `${d2}` + " cm "
        return s
    }
}
