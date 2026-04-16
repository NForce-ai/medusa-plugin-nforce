import { Module } from "@medusajs/framework/utils"
import NForceModuleService from "./service"

export const NFORCE_MODULE = "nforce"

export default Module(NFORCE_MODULE, {
  service: NForceModuleService,
})
