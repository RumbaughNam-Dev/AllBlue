import React, {Component} from 'react';
import {Animated, Image, StyleSheet, View} from 'react-native';

const popIcon = require('@/assets/games/apneatap/popicon_small.png');

const NUM_PARTICLES = 6;
const ICON_SIZE = 44;

interface BurstData {
  x: number;
  y: number;
  id: number;
}

interface Props {
  bursts: BurstData[];
}

interface ParticleState {
  angle: number;
  dist: number;
  tx: Animated.Value;
  ty: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
}

class Burst extends Component<{x: number; y: number}> {
  particles: ParticleState[];

  constructor(props: {x: number; y: number}) {
    super(props);
    this.particles = Array.from({length: NUM_PARTICLES}, (_, i) => {
      const angle = (i / NUM_PARTICLES) * Math.PI * 2;
      const dist = 50 + Math.random() * 40;
      return {
        angle,
        dist,
        tx: new Animated.Value(0),
        ty: new Animated.Value(0),
        opacity: new Animated.Value(1),
        scale: new Animated.Value(0.8),
      };
    });
  }

  componentDidMount() {
    this.particles.forEach(p => {
      const dx = Math.cos(p.angle) * p.dist;
      const dy = Math.sin(p.angle) * p.dist;

      Animated.parallel([
        Animated.timing(p.tx, {toValue: dx, duration: 600, useNativeDriver: true}),
        Animated.timing(p.ty, {toValue: dy, duration: 600, useNativeDriver: true}),
        Animated.sequence([
          Animated.timing(p.scale, {toValue: 1.2, duration: 200, useNativeDriver: true}),
          Animated.timing(p.scale, {toValue: 0.4, duration: 400, useNativeDriver: true}),
        ]),
        Animated.sequence([
          Animated.delay(250),
          Animated.timing(p.opacity, {toValue: 0, duration: 350, useNativeDriver: true}),
        ]),
      ]).start();
    });
  }

  shouldComponentUpdate() {
    return false;
  }

  render() {
    const {x, y} = this.props;
    return (
      <>
        {this.particles.map((p, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: x - ICON_SIZE / 2,
              top: y - ICON_SIZE / 2,
              width: ICON_SIZE,
              height: ICON_SIZE,
              opacity: p.opacity,
              transform: [{translateX: p.tx}, {translateY: p.ty}, {scale: p.scale}],
            }}>
            <Image source={popIcon} style={styles.icon} />
          </Animated.View>
        ))}
      </>
    );
  }
}

export default function PopBurst({bursts}: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Preload: keeps image decoded in memory */}
      <Image source={popIcon} style={styles.preload} />
      {bursts.map(b => (
        <Burst key={b.id} x={b.x} y={b.y} />
      ))}
    </View>
  );
}

export type {BurstData};

const styles = StyleSheet.create({
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    resizeMode: 'contain',
  },
  preload: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
  },
});
