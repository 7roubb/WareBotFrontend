import { useEffect, useState } from 'react';
import { Plus, Package, Edit, Trash2, Upload, X, DollarSign, Box, TrendingDown, TrendingUp, Settings } from 'lucide-react';
import { products, shelves } from '../services/api';

const PRODUCT_CATEGORIES = [
  'Electronics',
  'Clothing',
  'Food & Beverage',
  'Books',
  'Home & Garden',
  'Sports & Outdoors',
  'Toys & Games',
  'Beauty & Personal Care',
  'Health & Wellness',
  'Automotive',
  'Office Supplies',
  'Industrial Equipment',
  'Furniture',
  'Kitchen Appliances',
  'Lighting',
  'Tools & Hardware',
  'Textiles',
  'Accessories',
  'Art & Craft',
  'Digital Products',
  'Machinery',
  'Safety Equipment',
  'Packaging Materials',
  'Raw Materials',
  'Components',
  'Consumables',
  'Specialties',
  'Seasonal Items',
  'Clearance',
  'Other',
];

export default function Products() {
  const [productList, setProductList] = useState<any[]>([]);
  const [shelfList, setShelfList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [stockAction, setStockAction] = useState<'pick' | 'return' | 'adjust'>('adjust');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockData, setStockData] = useState({
    quantity: 0,
    description: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    quantity: 0,
    category: '',
    brand: '',
    price: 0,
    weight_kg: 0,
    barcode: '',
    shelf_id: '',
    description: '',
    main_image_url: '',
    image_urls: [] as string[],
    dimensions_cm: { length: 0, width: 0, height: 0 },
  });

  useEffect(() => {
    loadProducts();
    loadShelves();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await products.list();
      setProductList(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const loadShelves = async () => {
    try {
      const data = await shelves.list();
      setShelfList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load shelves:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await products.update(editingProduct.id, formData);
      } else {
        await products.create(formData);
      }
      loadProducts();
      closeModal();
      alert(`Product ${editingProduct ? 'updated' : 'created'} successfully`);
    } catch (error) {
      console.error('Failed to save product:', error);
      alert('Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this product?')) {
      try {
        await products.delete(id);
        loadProducts();
        alert('Product deleted successfully');
      } catch (error) {
        console.error('Failed to delete product:', error);
        alert('Failed to delete product');
      }
    }
  };

  const handleStockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (stockAction === 'pick') {
        await products.pickStock(selectedProduct.id, stockData.quantity, stockData.description);
      } else if (stockAction === 'return') {
        await products.returnStock(selectedProduct.id, stockData.quantity, stockData.description);
      } else if (stockAction === 'adjust') {
        await products.adjustStock(selectedProduct.id, stockData.quantity, stockData.description);
      }
      loadProducts();
      closeStockModal();
      alert('Stock updated successfully');
    } catch (error) {
      console.error('Failed to update stock:', error);
      alert('Failed to update stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openStockModal = (product: any) => {
    setSelectedProduct(product);
    setStockData({ quantity: product.quantity, description: '' });
    setStockAction('adjust');
    setShowStockModal(true);
  };

  const closeStockModal = () => {
    setShowStockModal(false);
    setSelectedProduct(null);
    setStockData({ quantity: 0, description: '' });
  };

  const handleImageUpload = async (productId: string, file: File) => {
    try {
      await products.uploadImage(productId, file);
      loadProducts();
      alert('Image uploaded successfully');
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image');
    }
  };

  const openModal = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        category: product.category || '',
        brand: product.brand || '',
        price: product.price || 0,
        weight_kg: product.weight_kg || 0,
        barcode: product.barcode || '',
        shelf_id: product.shelf_id || '',
        description: product.description || '',
        main_image_url: product.main_image_url || '',
        image_urls: product.image_urls || [],
        dimensions_cm: product.dimensions_cm || { length: 0, width: 0, height: 0 },
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        quantity: 0,
        category: '',
        brand: '',
        price: 0,
        weight_kg: 0,
        barcode: '',
        shelf_id: '',
        description: '',
        main_image_url: '',
        image_urls: [],
        dimensions_cm: { length: 0, width: 0, height: 0 },
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Products</h1>
          <p className="text-accent/70">Manage inventory and product details</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-accent text-accent-foreground font-bold hover:brightness-110 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Products Grid */}
      <div className="data-grid">
        {productList.map((product) => (
          <div
            key={product.id}
            className="bg-card/80 backdrop-blur rounded-xl border border-border/30 overflow-hidden hover:border-primary/30 shadow-md hover:shadow-lg transition-all duration-300"
          >
            {/* Image */}
            <div className="relative h-40 bg-card/50 flex items-center justify-center overflow-hidden border-b border-border/30">
              {product.main_image_url || product.image_urls?.[0] ? (
                <img
                  src={product.main_image_url || product.image_urls[0]}
                  alt={product.name}
                  className="w-full h-full object-cover hover:scale-105 transition duration-300"
                />
              ) : (
                <Package className="w-12 h-12 text-muted-foreground/50" />
              )}
              <label className="absolute top-2 right-2 p-2 rounded-lg bg-card/80 hover:bg-card backdrop-blur cursor-pointer transition border border-border/50">
                <Upload className="w-4 h-4 text-primary" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(product.id, file);
                  }}
                />
              </label>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="font-bold text-foreground truncate mb-1 text-sm">{product.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">SKU: {product.sku}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center">
                    <Box className="w-3 h-3 mr-1" /> Stock
                  </span>
                  <span className="font-bold text-primary text-sm">{product.quantity}</span>
                </div>

                {product.price ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center">
                      <DollarSign className="w-3 h-3 mr-1" /> Price
                    </span>
                    <span className="font-bold text-accent text-sm">${product.price.toFixed(2)}</span>
                  </div>
                ) : null}

                {product.category && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                      {product.category}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openStockModal(product)}
                  className="flex-1 px-2 py-2 rounded-lg bg-secondary/50 text-secondary-foreground hover:bg-secondary/70 border border-border/30 text-xs font-semibold transition flex items-center justify-center gap-1"
                  title="Manage Stock"
                >
                  <Settings className="w-3 h-3" /> Stock
                </button>
                <button
                  onClick={() => openModal(product)}
                  className="flex-1 px-2 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs font-semibold transition flex items-center justify-center gap-1"
                >
                  <Edit className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="flex-1 px-2 py-2 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30 text-xs font-semibold transition flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card/80 backdrop-blur rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border/30">
            <div className="sticky top-0 bg-card/50 text-foreground p-6 flex items-center justify-between border-b border-border/30">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Package className="w-6 h-6 text-primary" />
                {editingProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-secondary/50 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  >
                    <option value="">Select a category</option>
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Brand
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.weight_kg}
                    onChange={(e) =>
                      setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Shelf
                  </label>
                  <select
                    value={formData.shelf_id}
                    onChange={(e) =>
                      setFormData({ ...formData, shelf_id: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  >
                    <option value="">Select a shelf</option>
                    {shelfList.map((shelf) => (
                      <option key={shelf.id} value={shelf.id}>
                        Shelf ({Number(shelf.x ?? 0).toFixed(1)}, {Number(shelf.y ?? 0).toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Main Image URL
                  </label>
                  <input
                    type="url"
                    value={formData.main_image_url}
                    onChange={(e) =>
                      setFormData({ ...formData, main_image_url: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Length (cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.dimensions_cm.length}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dimensions_cm: { ...formData.dimensions_cm, length: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Width (cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.dimensions_cm.width}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dimensions_cm: { ...formData.dimensions_cm, width: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.dimensions_cm.height}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dimensions_cm: { ...formData.dimensions_cm, height: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="Enter product description"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border/30">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-accent text-accent-foreground py-3 rounded-lg font-bold hover:brightness-110 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 bg-secondary/50 text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/70 transition border border-border/30"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Management Modal */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card/80 backdrop-blur rounded-xl shadow-lg max-w-md w-full border border-border/30">
            <div className="bg-card/50 text-foreground p-6 flex items-center justify-between border-b border-border/30">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Settings className="w-6 h-6 text-accent" />
                Manage Stock
              </h2>
              <button
                onClick={closeStockModal}
                className="p-2 hover:bg-secondary/50 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleStockAction} className="p-6 space-y-4">
              <div className="bg-card/50 p-4 rounded-lg border border-border/30">
                <p className="text-muted-foreground text-sm mb-2">Product</p>
                <p className="font-bold text-foreground text-lg">{selectedProduct.name}</p>
                <p className="text-muted-foreground text-sm">Current Stock: {selectedProduct.quantity}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">
                  Action
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setStockAction('pick')}
                    className={`p-3 rounded-lg border transition flex flex-col items-center space-y-1 ${
                      stockAction === 'pick'
                        ? 'bg-destructive/20 border-destructive/50 text-destructive'
                        : 'bg-card/50 border-border/30 text-muted-foreground hover:border-border/50'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-xs font-semibold">Pick</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockAction('return')}
                    className={`p-3 rounded-lg border transition flex flex-col items-center space-y-1 ${
                      stockAction === 'return'
                        ? 'bg-success/20 border-success/50 text-success'
                        : 'bg-card/50 border-border/30 text-muted-foreground hover:border-border/50'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-semibold">Return</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockAction('adjust')}
                    className={`p-3 rounded-lg border transition flex flex-col items-center space-y-1 ${
                      stockAction === 'adjust'
                        ? 'bg-primary/20 border-primary/50 text-primary'
                        : 'bg-card/50 border-border/30 text-muted-foreground hover:border-border/50'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-xs font-semibold">Adjust</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {stockAction === 'adjust' ? 'New Quantity *' : 'Quantity *'}
                </label>
                <input
                  type="number"
                  value={stockData.quantity}
                  onChange={(e) =>
                    setStockData({ ...stockData, quantity: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Reason / Description
                </label>
                <textarea
                  value={stockData.description}
                  onChange={(e) =>
                    setStockData({ ...stockData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2 rounded-lg bg-card/50 border border-border/30 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="e.g., Damaged items, Customer return, Inventory correction"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border/30">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-accent text-accent-foreground py-3 rounded-lg font-bold hover:brightness-110 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Update Stock'}
                </button>
                <button
                  type="button"
                  onClick={closeStockModal}
                  className="px-6 py-3 bg-secondary/50 text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/70 transition border border-border/30"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
