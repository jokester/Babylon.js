import * as React from "react";

import { Observable } from "core/Misc/observable";
import { GlobalState } from "../../../../globalState";
import { PropertyChangedEvent } from "../../../../propertyChangedEvent";
import { SliderLineComponent } from "shared-ui-components/lines/sliderLineComponent";
import { FloatLineComponent } from "shared-ui-components/lines/floatLineComponent";
import { LockObject } from "shared-ui-components/tabs/propertyGrids/lockObject";
import { HemisphericParticleEmitter } from "core/Particles/EmitterTypes/hemisphericParticleEmitter";

interface IHemisphericEmitterGridComponentProps {
    globalState: GlobalState;
    emitter: HemisphericParticleEmitter;
    lockObject: LockObject;
    onPropertyChangedObservable?: Observable<PropertyChangedEvent>;
}

export class HemisphericEmitterGridComponent extends React.Component<IHemisphericEmitterGridComponentProps> {
    constructor(props: IHemisphericEmitterGridComponentProps) {
        super(props);
    }

    render() {
        const emitter = this.props.emitter;
        return (
            <>
                <FloatLineComponent
                    lockObject={this.props.lockObject}
                    label="Radius"
                    target={emitter}
                    propertyName="radius"
                    onPropertyChangedObservable={this.props.onPropertyChangedObservable}
                />
                <SliderLineComponent
                    label="Radius range"
                    target={emitter}
                    propertyName="radiusRange"
                    minimum={0}
                    maximum={1}
                    step={0.01}
                    onPropertyChangedObservable={this.props.onPropertyChangedObservable}
                />
                <SliderLineComponent
                    label="Direction randomizer"
                    target={emitter}
                    propertyName="directionRandomizer"
                    minimum={0}
                    maximum={1}
                    step={0.01}
                    onPropertyChangedObservable={this.props.onPropertyChangedObservable}
                />
            </>
        );
    }
}
