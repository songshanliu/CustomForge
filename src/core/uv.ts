/** 目标 Mesh 的二维 UV 布局 */
export interface UvLayout {
  /** 每六个连续值依次表示一个三角形的 u1、v1、u2、v2、u3、v3 */
  triangleCoordinates: Float32Array

  /** 每四个连续值依次表示一条 UV 外边界的 u1、v1、u2、v2 */
  boundaryCoordinates: Float32Array
}
