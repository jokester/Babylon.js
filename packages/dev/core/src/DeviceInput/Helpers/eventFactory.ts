import { Constants } from "../../Engines/constants";
import { EventConstants, IUIEvent } from "../../Events/deviceInputEvents";
import { Nullable } from "../../types";
import { DeviceType, NativePointerInput, PointerInput } from "../InputDevices/deviceEnums";
import { IDeviceInputSystem } from "../InputDevices/inputInterfaces";

/**
 * Class to wrap DeviceInputSystem data into an event object
 */
export class DeviceEventFactory {
    /**
     * Create device input events based on provided type and slot
     *
     * @param deviceType Type of device
     * @param deviceSlot "Slot" or index that device is referenced in
     * @param inputIndex Id of input to be checked
     * @param currentState Current value for given input
     * @param deviceInputSystem Reference to DeviceInputSystem
     * @param elementToAttachTo HTMLElement to reference as target for inputs
     * @returns IUIEvent object
     */
    public static CreateDeviceEvent(
        deviceType: DeviceType,
        deviceSlot: number,
        inputIndex: number,
        currentState: Nullable<number>,
        deviceInputSystem: IDeviceInputSystem,
        elementToAttachTo?: any
    ): IUIEvent {
        switch (deviceType) {
            case DeviceType.Keyboard:
                return this._createKeyboardEvent(inputIndex, currentState, deviceInputSystem, elementToAttachTo);
            case DeviceType.Mouse:
                if (inputIndex === PointerInput.MouseWheelX || inputIndex === PointerInput.MouseWheelY || inputIndex === PointerInput.MouseWheelZ) {
                    return this._createWheelEvent(deviceType, deviceSlot, inputIndex, currentState, deviceInputSystem, elementToAttachTo);
                }
            case DeviceType.Touch:
                return this._createPointerEvent(deviceType, deviceSlot, inputIndex, currentState, deviceInputSystem, elementToAttachTo);
            default:
                throw `Unable to generate event for device ${DeviceType[deviceType]}`;
        }
    }

    /**
     * Creates pointer event
     *
     * @param deviceType Type of device
     * @param deviceSlot "Slot" or index that device is referenced in
     * @param inputIndex Id of input to be checked
     * @param currentState Current value for given input
     * @param deviceInputSystem Reference to DeviceInputSystem
     * @param elementToAttachTo HTMLElement to reference as target for inputs
     * @returns IUIEvent object (Pointer)
     */
    private static _createPointerEvent(
        deviceType: DeviceType,
        deviceSlot: number,
        inputIndex: number,
        currentState: Nullable<number>,
        deviceInputSystem: IDeviceInputSystem,
        elementToAttachTo?: any
    ): any {
        const evt = this._createMouseEvent(deviceType, deviceSlot, inputIndex, currentState, deviceInputSystem, elementToAttachTo);

        if (deviceType === DeviceType.Mouse) {
            evt.deviceType = DeviceType.Mouse;
            evt.pointerId = 1;
            evt.pointerType = "mouse";
        } else {
            evt.deviceType = DeviceType.Touch;
            evt.pointerId = deviceSlot;
            evt.pointerType = "touch";
        }

        if (inputIndex === PointerInput.Move) {
            evt.type = "pointermove";
        } else if (inputIndex >= PointerInput.LeftClick && inputIndex <= PointerInput.RightClick) {
            evt.type = currentState === 1 ? "pointerdown" : "pointerup";
            evt.button = inputIndex - 2;
        }

        return evt;
    }

    /**
     * Create Mouse Wheel Event
     * @param deviceType Type of device
     * @param deviceSlot "Slot" or index that device is referenced in
     * @param inputIndex Id of input to be checked
     * @param currentState Current value for given input
     * @param deviceInputSystem Reference to DeviceInputSystem
     * @param elementToAttachTo HTMLElement to reference as target for inputs
     * @returns IUIEvent object (Wheel)
     */
    private static _createWheelEvent(
        deviceType: DeviceType,
        deviceSlot: number,
        inputIndex: number,
        currentState: Nullable<number>,
        deviceInputSystem: IDeviceInputSystem,
        elementToAttachTo: any
    ): any {
        const evt = this._createMouseEvent(deviceType, deviceSlot, inputIndex, currentState, deviceInputSystem, elementToAttachTo);

        evt.type = "wheel";
        evt.deltaMode = EventConstants.DOM_DELTA_PIXEL;
        evt.deltaX = inputIndex === PointerInput.MouseWheelX ? currentState : deviceInputSystem.pollInput(deviceType, deviceSlot, PointerInput.MouseWheelX);
        evt.deltaY = inputIndex === PointerInput.MouseWheelY ? currentState : deviceInputSystem.pollInput(deviceType, deviceSlot, PointerInput.MouseWheelY);
        evt.deltaZ = inputIndex === PointerInput.MouseWheelZ ? currentState : deviceInputSystem.pollInput(deviceType, deviceSlot, PointerInput.MouseWheelZ);

        return evt;
    }

    /**
     * Create Mouse Event
     * @param deviceType Type of device
     * @param deviceSlot "Slot" or index that device is referenced in
     * @param inputIndex Id of input to be checked
     * @param currentState Current value for given input
     * @param deviceInputSystem Reference to DeviceInputSystem
     * @param elementToAttachTo HTMLElement to reference as target for inputs
     * @returns IUIEvent object (Mouse)
     */
    private static _createMouseEvent(
        deviceType: DeviceType,
        deviceSlot: number,
        inputIndex: number,
        currentState: Nullable<number>,
        deviceInputSystem: IDeviceInputSystem,
        elementToAttachTo?: any
    ): any {
        const evt = this._createEvent(elementToAttachTo);
        const pointerX = deviceInputSystem.pollInput(deviceType, deviceSlot, PointerInput.Horizontal);
        const pointerY = deviceInputSystem.pollInput(deviceType, deviceSlot, PointerInput.Vertical);

        // Handle offsets/deltas based on existence of HTMLElement
        if (elementToAttachTo) {
            evt.movementX = 0;
            evt.movementY = 0;
            evt.offsetX = evt.movementX - elementToAttachTo.getBoundingClientRect().x;
            evt.offsetY = evt.movementY - elementToAttachTo.getBoundingClientRect().y;
        } else {
            evt.movementX = deviceInputSystem.pollInput(deviceType, deviceSlot, NativePointerInput.DeltaHorizontal); // DeltaHorizontal
            evt.movementY = deviceInputSystem.pollInput(deviceType, deviceSlot, NativePointerInput.DeltaVertical); // DeltaVertical
            evt.offsetX = 0;
            evt.offsetY = 0;
        }
        this._checkNonCharacterKeys(evt, deviceInputSystem);

        evt.clientX = pointerX;
        evt.clientY = pointerY;
        evt.x = pointerX;
        evt.y = pointerY;

        evt.deviceType = deviceType;
        evt.deviceSlot = deviceSlot;
        evt.inputIndex = inputIndex;

        return evt;
    }

    /**
     * Create Keyboard Event
     * @param inputIndex Id of input to be checked
     * @param currentState Current value for given input
     * @param deviceInputSystem Reference to DeviceInputSystem
     * @param elementToAttachTo HTMLElement to reference as target for inputs
     * @returns IEvent object (Keyboard)
     */
    private static _createKeyboardEvent(inputIndex: number, currentState: Nullable<number>, deviceInputSystem: IDeviceInputSystem, elementToAttachTo?: any): any {
        const evt = this._createEvent(elementToAttachTo);
        this._checkNonCharacterKeys(evt, deviceInputSystem);
        evt.deviceType = DeviceType.Keyboard;
        evt.deviceSlot = 0;
        evt.inputIndex = inputIndex;

        evt.type = currentState === 1 ? "keydown" : "keyup";
        evt.key = String.fromCharCode(inputIndex);
        evt.keyCode = inputIndex;

        return evt;
    }

    /**
     * Add parameters for non-character keys (Ctrl, Alt, Meta, Shift)
     * @param evt Event object to add parameters to
     * @param deviceInputSystem DeviceInputSystem to pull values from
     */
    private static _checkNonCharacterKeys(evt: any, deviceInputSystem: IDeviceInputSystem): void {
        const isKeyboardActive = deviceInputSystem.isDeviceAvailable(DeviceType.Keyboard);
        const altKey = isKeyboardActive && deviceInputSystem.pollInput(DeviceType.Keyboard, 0, Constants.INPUT_ALT_KEY) === 1;
        const ctrlKey = isKeyboardActive && deviceInputSystem.pollInput(DeviceType.Keyboard, 0, Constants.INPUT_CTRL_KEY) === 1;
        const metaKey =
            isKeyboardActive &&
            (deviceInputSystem.pollInput(DeviceType.Keyboard, 0, Constants.INPUT_META_KEY1) === 1 ||
                deviceInputSystem.pollInput(DeviceType.Keyboard, 0, Constants.INPUT_META_KEY2) === 1 ||
                deviceInputSystem.pollInput(DeviceType.Keyboard, 0, Constants.INPUT_META_KEY3) === 1);
        const shiftKey = isKeyboardActive && deviceInputSystem.pollInput(DeviceType.Keyboard, 0, Constants.INPUT_SHIFT_KEY) === 1;

        evt.altKey = altKey;
        evt.ctrlKey = ctrlKey;
        evt.metaKey = metaKey;
        evt.shiftKey = shiftKey;
    }

    /**
     * Create base event object
     * @param elementToAttachTo Value to use as event target
     * @returns
     */
    private static _createEvent(elementToAttachTo: any): any {
        const evt: { [k: string]: any } = {};
        evt.preventDefault = () => {};
        evt.target = elementToAttachTo;

        return evt;
    }
}
