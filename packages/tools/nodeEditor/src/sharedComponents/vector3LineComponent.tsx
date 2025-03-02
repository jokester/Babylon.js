import * as React from "react";
import { Vector3 } from "core/Maths/math.vector";
import { Observable } from "core/Misc/observable";

import { NumericInputComponent } from "./numericInputComponent";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { PropertyChangedEvent } from "./propertyChangedEvent";
import { GlobalState } from "../globalState";

interface IVector3LineComponentProps {
    label: string;
    target: any;
    propertyName: string;
    step?: number;
    onChange?: (newvalue: Vector3) => void;
    onPropertyChangedObservable?: Observable<PropertyChangedEvent>;
    globalState: GlobalState;
}

export class Vector3LineComponent extends React.Component<IVector3LineComponentProps, { isExpanded: boolean; value: Vector3 }> {
    static defaultProps = {
        step: 0.001, // cm
    };

    private _localChange = false;

    constructor(props: IVector3LineComponentProps) {
        super(props);

        this.state = { isExpanded: false, value: this.props.target[this.props.propertyName].clone() };
    }

    shouldComponentUpdate(nextProps: IVector3LineComponentProps, nextState: { isExpanded: boolean; value: Vector3 }) {
        const nextPropsValue = nextProps.target[nextProps.propertyName];

        if (!nextPropsValue.equals(nextState.value) || this._localChange) {
            nextState.value = nextPropsValue.clone();
            this._localChange = false;
            return true;
        }
        return false;
    }

    switchExpandState() {
        this._localChange = true;
        this.setState({ isExpanded: !this.state.isExpanded });
    }

    raiseOnPropertyChanged(previousValue: Vector3) {
        if (this.props.onChange) {
            this.props.onChange(this.state.value);
        }

        if (!this.props.onPropertyChangedObservable) {
            return;
        }
        this.props.onPropertyChangedObservable.notifyObservers({
            object: this.props.target,
            property: this.props.propertyName,
            value: this.state.value,
            initialValue: previousValue,
        });
    }

    updateVector3() {
        const store = this.props.target[this.props.propertyName].clone();
        this.props.target[this.props.propertyName] = this.state.value;

        this.setState({ value: store });

        this.raiseOnPropertyChanged(store);
    }

    updateStateX(value: number) {
        this._localChange = true;

        this.state.value.x = value;
        this.updateVector3();
    }

    updateStateY(value: number) {
        this._localChange = true;

        this.state.value.y = value;
        this.updateVector3();
    }

    updateStateZ(value: number) {
        this._localChange = true;

        this.state.value.z = value;
        this.updateVector3();
    }

    render() {
        const chevron = this.state.isExpanded ? <FontAwesomeIcon icon={faMinus} /> : <FontAwesomeIcon icon={faPlus} />;

        return (
            <div className="vector3Line">
                <div className="firstLine">
                    <div className="label" title={this.props.label}>
                        {this.props.label}
                    </div>
                    <div className="vector">{`X: ${this.state.value.x.toFixed(2)}, Y: ${this.state.value.y.toFixed(2)}, Z: ${this.state.value.z.toFixed(2)}`}</div>
                    <div className="expand hoverIcon" onClick={() => this.switchExpandState()} title="Expand">
                        {chevron}
                    </div>
                </div>
                {this.state.isExpanded && (
                    <div className="secondLine">
                        <NumericInputComponent
                            globalState={this.props.globalState}
                            label="x"
                            step={this.props.step}
                            value={this.state.value.x}
                            onChange={(value) => this.updateStateX(value)}
                        />
                        <NumericInputComponent
                            globalState={this.props.globalState}
                            label="y"
                            step={this.props.step}
                            value={this.state.value.y}
                            onChange={(value) => this.updateStateY(value)}
                        />
                        <NumericInputComponent
                            globalState={this.props.globalState}
                            label="z"
                            step={this.props.step}
                            value={this.state.value.z}
                            onChange={(value) => this.updateStateZ(value)}
                        />
                    </div>
                )}
            </div>
        );
    }
}
