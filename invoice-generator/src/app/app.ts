import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface InvoiceItem {
  description: string;
  qty: number;
  rate: number;
  sgst: number;
  cgst: number;
  amount: number;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('invoice-generator');
  
  invoiceForm: FormGroup;
  logoFile: File | null = null;
  logoPreview: string | null = null;
  
  constructor(private fb: FormBuilder) {
    this.invoiceForm = this.createInvoiceForm();
  }
  
  private createInvoiceForm(): FormGroup {
    return this.fb.group({
      // Company Details
      companyName: ['Flame to Fable', Validators.required],
      yourName: ['Your Name', Validators.required],
      gstin: ['Company\'s GSTIN'],
     
      city: ['Ernakulam'],
      state: ['Kerala'],
      
      contact: ['9400712698'],
      email: ['flametofable@gmail.com'],
      
      // Bill To Details
      clientCompany: ['Shaheen N S'],
      clientGstin: ['Client\'s GSTIN'],
      clientAddress: ['Client\'s Address'],
      clientCity: ['Kerala'],
      clientState: ['State'],
      clientCountry: ['India'],
      
      // Invoice Details
      invoiceNumber: ['INV2801'],
      invoiceDate: [new Date().toISOString().split('T')[0]],
      dueDate: [new Date().toISOString().split('T')[0]],
      placeOfSupply: ['Kerala'],
      incentiveNumber: ['INC001'],
      
      // Items
      items: this.fb.array([this.createInvoiceItem()]),
      
      // Notes and Terms
      notes: ['Thank you for your purchase'],
      terms: ['Please make the payment by the due date.'],
      
      // Additional Charges
      shippingCharges: [0, [Validators.min(0)]],
      
      // Footer Message
      footerMessage: ['Handcrafted with love']
    });
  }
  
  private createInvoiceItem(): FormGroup {
    return this.fb.group({
      description: ['Coffee Latte Candle', Validators.required],
      qty: [1, [Validators.required, Validators.min(1)]],
      rate: [0, [Validators.required, Validators.min(0)]],
      sgst: [0, [Validators.min(0), Validators.max(100)]],
      cgst: [0, [Validators.min(0), Validators.max(100)]],
      amount: [{value: 0, disabled: true}]
    });
  }
  
  get items(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }
  
  addLineItem(): void {
    this.items.push(this.createInvoiceItem());
  }
  
  removeLineItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
    }
  }
  
  onItemChange(index: number): void {
    const item = this.items.at(index);
    const qty = item.get('qty')?.value || 0;
    const rate = item.get('rate')?.value || 0;
    const amount = qty * rate;
    item.get('amount')?.setValue(amount);
  }
  
  onLogoUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.logoFile = input.files[0];
      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.logoPreview = e.target?.result as string;
      };
      reader.readAsDataURL(this.logoFile);
    }
  }
  
  getSubTotal(): number {
    return this.items.controls.reduce((total, item) => {
      return total + (item.get('amount')?.value || 0);
    }, 0);
  }
  
  getSGSTTotal(): number {
    return this.items.controls.reduce((total, item) => {
      const amount = item.get('amount')?.value || 0;
      const sgst = item.get('sgst')?.value || 0;
      return total + (amount * sgst / 100);
    }, 0);
  }
  
  getCGSTTotal(): number {
    return this.items.controls.reduce((total, item) => {
      const amount = item.get('amount')?.value || 0;
      const cgst = item.get('cgst')?.value || 0;
      return total + (amount * cgst / 100);
    }, 0);
  }
  
  getGrandTotal(): number {
    const subTotal = this.getSubTotal();
    const sgstTotal = this.getSGSTTotal();
    const cgstTotal = this.getCGSTTotal();
    const shipping = this.invoiceForm.get('shippingCharges')?.value || 0;
    return subTotal + sgstTotal + cgstTotal + shipping;
  }
  
  downloadInvoice(): void {
    const invoiceElement = document.querySelector('.invoice-generator') as HTMLElement;
    
    if (!invoiceElement) {
      console.error('Invoice element not found');
      return;
    }

    // Add loading state
    const downloadBtn = document.querySelector('.btn-outline') as HTMLElement;
    const originalText = downloadBtn?.innerHTML;
    if (downloadBtn) {
      downloadBtn.innerHTML = '<span class="icon">⏳</span> Generating PDF...';
      downloadBtn.style.pointerEvents = 'none';
    }

    // Hide buttons and non-printable elements before capturing
    const buttons = invoiceElement.querySelectorAll('.header, .btn');
    buttons.forEach(btn => (btn as HTMLElement).style.display = 'none');
    
    // Add pdf-mode class for better styling
    invoiceElement.classList.add('pdf-mode');

    // Configure html2canvas options for better quality
    const options = {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: invoiceElement.scrollWidth,
      height: invoiceElement.scrollHeight,
      scrollX: 0,
      scrollY: 0
    };

    html2canvas(invoiceElement, options).then(canvas => {
      try {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Calculate dimensions to fit the content properly
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // Calculate scale to fit width, with some margin
        const margin = 10;
        const availableWidth = pdfWidth - (2 * margin);
        const scale = availableWidth / (imgWidth * 0.264583); // Convert px to mm
        
        const finalWidth = (imgWidth * 0.264583) * scale;
        const finalHeight = (imgHeight * 0.264583) * scale;

        // Check if content fits in one page
        if (finalHeight > pdfHeight - (2 * margin)) {
          // If content is too tall, we might need to split it or scale it down further
          const heightScale = (pdfHeight - (2 * margin)) / finalHeight;
          const adjustedWidth = finalWidth * heightScale;
          const adjustedHeight = finalHeight * heightScale;
          
          pdf.addImage(imgData, 'PNG', margin, margin, adjustedWidth, adjustedHeight);
        } else {
          pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);
        }
        
        // Get invoice number for filename
        const invoiceNumber = this.invoiceForm.get('invoiceNumber')?.value || 'invoice';
        const cleanInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_');
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `invoice_${cleanInvoiceNumber}_${timestamp}.pdf`;
        
        pdf.save(filename);
        
        // Show success message
        if (downloadBtn) {
          downloadBtn.innerHTML = '<span class="icon">✓</span> Downloaded!';
          setTimeout(() => {
            if (originalText && downloadBtn) {
              downloadBtn.innerHTML = originalText;
            }
          }, 2000);
        }
        
      } catch (pdfError) {
        console.error('Error creating PDF:', pdfError);
        alert('Error creating PDF file. Please try again.');
        if (downloadBtn && originalText) {
          downloadBtn.innerHTML = originalText;
        }
      }
      
    }).catch(error => {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please check your browser settings and try again.');
      if (downloadBtn && originalText) {
        downloadBtn.innerHTML = originalText;
      }
    }).finally(() => {
      // Always restore the UI state
      buttons.forEach(btn => (btn as HTMLElement).style.display = '');
      invoiceElement.classList.remove('pdf-mode');
      if (downloadBtn) {
        downloadBtn.style.pointerEvents = 'auto';
      }
    });
  }
  
  printInvoice(): void {
    window.print();
  }
  
  saveOnline(): void {
    // This would implement online saving functionality
    console.log('Saving online...');
    alert('Online save feature will be implemented soon!');
  }

}
