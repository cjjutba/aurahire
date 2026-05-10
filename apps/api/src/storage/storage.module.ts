import { Global, Module } from "@nestjs/common";
import { DocxToPdfService } from "./docx-to-pdf.service";
import { StorageService } from "./storage.service";

@Global()
@Module({
  providers: [StorageService, DocxToPdfService],
  exports: [StorageService, DocxToPdfService],
})
export class StorageModule {}
