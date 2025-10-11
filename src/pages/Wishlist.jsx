import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FamilyMember, WishlistItem } from '@/api/entities';
import { useFamilyData } from "@/hooks/FamilyDataContext";
// Debug: log WishlistItem after all imports
console.log('WishlistItem import:', WishlistItem);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Lock, Loader2, Link as LinkIcon, Check, PartyPopper, PlusCircle, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { InvokeLLM } from "@/api/integrations";

const Wishlist = () => {
  const [searchParams] = useSearchParams();
  const { user, family, members, isFamilyMember, memberId } = useFamilyData();
  const [items, setItems] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', url: '', price: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [accessState, setAccessState] = useState('loading');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [member, setMember] = useState(null);
  const toast = useToast();


  useEffect(() => {
  // Use lowercase 'memberid' to match the URL
  const memberIdParam = searchParams.get('memberid');
    console.log('Wishlist useEffect: members', members, 'memberIdParam', memberIdParam);
    if (members && memberIdParam) {
      const m = members.find(m => m.id === memberIdParam);
      console.log('Wishlist useEffect: found member', m);
      setMember(m);
    } else {
      setMember(null);
    }
    setAccessState('loading');
  }, [members, searchParams]);

  useEffect(() => {
    if (member && member.id) {
      console.log('Wishlist useEffect: loading items for member', member.id);
      loadItems(member.id);
    } else if (members && members.length > 0) {
      console.warn('Wishlist: No valid member selected, cannot load items.');
    }
  }, [member, members]);

  const loadItems = async (memberIdToLoad) => {
    setAccessState('loading');
    try {
      console.log('Calling WishlistItem.filter with', memberIdToLoad);
      const response = await WishlistItem.filter({ family_member_id: memberIdToLoad });
      console.log('WishlistItem.filter response:', response);
      // Try to support both array and {results: array}
      const itemsArray = Array.isArray(response) ? response : (response?.results || []);
      setItems(itemsArray);
      setAccessState('visible');
    } catch (e) {
      setItems([]);
      setAccessState('error');
      setErrorMessage('Kon verlanglijst niet laden.');
      console.error('WishlistItem.filter error:', e);
    }
  };

  const handleClaim = async (item) => {
    try {
      // await WishlistItem.update(item.id, { status: 'claimed', claimed_by_name: user?.name });
      toast({ title: "Item geclaimd!", description: `Je hebt ${item.name} succesvol geclaimd.`, duration: 5000 });
  loadItems(member.id);
    } catch (e) {
      toast({ title: "Fout", description: "Kon item niet claimen.", variant: "destructive", duration: 5000 });
    }
  };

  const handleUnclaim = async (item) => {
    if (window.confirm("Weet je zeker dat je dit item wilt vrijgeven zodat het weer beschikbaar is?")) {
      try {
        // await WishlistItem.update(item.id, { status: 'available', claimed_by_name: null });
        toast({ title: "Item vrijgegeven", description: `${item.name} is weer beschikbaar.`, duration: 5000 });
  loadItems(member.id);
      } catch (e) {
        toast({ title: "Fout", description: "Kon item niet vrijgeven.", variant: "destructive", duration: 5000 });
      }
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name) {
      toast({ title: "Naam is verplicht", variant: "destructive", duration: 5000 });
      return;
    }
    setIsAdding(true);
    try {
      let price = newItem.price ? parseFloat(newItem.price) : null;
      if (newItem.url && !price) {
        try {
          const priceResult = await InvokeLLM({
            prompt: `Haal de numerieke prijs uit de inhoud van deze URL: ${newItem.url}`,
            add_context_from_internet: true,
            response_json_schema: {
              type: "object",
              properties: { price: { type: "number" } }
            }
          });
          if (priceResult && typeof priceResult.price === 'number') {
            price = priceResult.price;
          }
        } catch (priceError) {
          console.warn("Kon prijs niet automatisch ophalen:", priceError);
        }
      }
      // await WishlistItem.create({
      //   name: newItem.name,
      //   url: newItem.url || null,
      //   price: price,
      //   family_member_id: memberId
      // });
      toast({ title: "Item toegevoegd!", description: `${newItem.name} is toegevoegd aan de verlanglijst.`, duration: 5000 });
      setNewItem({ name: '', url: '', price: '' });
      setShowAddForm(false);
      loadItems();
    } catch (e) {
      console.error("Fout bij toevoegen item:", e);
      toast({ title: "Fout", description: "Kon item niet toevoegen.", variant: "destructive", duration: 5000 });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (window.confirm(`Weet je zeker dat je dit item wilt verwijderen?`)) {
      try {
        // await WishlistItem.delete(itemId);
        toast({ title: "Item verwijderd", description: "Het item is verwijderd van de verlanglijst.", duration: 5000 });
  loadItems(member.id);
      } catch (e) {
        toast({ title: "Fout", description: "Kon item niet verwijderen.", variant: "destructive", duration: 5000 });
      }
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link gekopieerd!",
      description: "De link naar deze verlanglijst is naar je klembord gekopieerd.",
      duration: 5000
    });
  };

  if (accessState === 'loading') {
    // If member is null after loading, show a fallback error
    if (members && members.length > 0 && !member) {
      return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 flex flex-col justify-center items-center">
          <div className="text-center">
            <X className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">Geen geldige gebruiker</h1>
            <p className="text-gray-500 mt-1">Kon geen familielid vinden voor deze verlanglijst.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8 flex flex-col justify-center items-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-pink-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800">Verlanglijst laden...</h1>
          <p className="text-gray-500 mt-1">Even geduld alstublieft</p>
        </div>
      </div>
    );
  }

  if (accessState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8 flex flex-col justify-center items-center">
        <div className="text-center">
          <X className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800">Fout</h1>
          <p className="text-gray-500 mt-1">Er is iets misgegaan</p>
          <div className="mt-4 p-4 text-red-600 rounded-md bg-red-50">{errorMessage}</div>
        </div>
      </div>
    );
  }

  if (accessState === 'password_prompt') {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <header className="text-center mb-8">
            <div style={{ backgroundColor: member?.color || '#e2e8f0' }} className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-bold text-white shadow-lg">
              {member?.name?.charAt(0)?.toUpperCase() || '🔒'}
            </div>
            <h1 className="text-4xl font-bold text-gray-800">Verlanglijst</h1>
            <p className="text-gray-500 mt-1">Voer het wachtwoord in om deze verlanglijst te bekijken.</p>
          </header>
          <Card className="max-w-sm mx-auto">
            <CardContent className="p-6">
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2"><Lock className="w-5 h-5"/> Deze verlanglijst is beschermd.</h3>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Voer wachtwoord in" required />
                <Button type="submit" className="w-full">Ontgrendel verlanglijst</Button>
                {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (accessState === 'visible') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <div className="w-16 h-16 rounded-full mb-4 flex items-center justify-center text-white text-2xl font-bold shadow-lg" style={{ backgroundColor: member?.color || '#8b5cf6' }}>
                {member?.name?.charAt(0)?.toUpperCase() || '🎁'}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Gift className="w-8 h-8 text-pink-500" />
                Verlanglijst {member?.name ? `voor ${member.name}` : ''}
              </h1>
              {member?.dob && (
                <p className="text-gray-500">Wordt {new Date().getFullYear() - new Date(member.dob).getFullYear() + 1} jaar!</p>
              )}
              <div className="flex items-center gap-2 text-purple-600 mt-2">
                <PartyPopper className="w-5 h-5" />
                <span className="text-lg">Cadeautjes die mij blij maken!</span>
              </div>
            </div>
            <Button onClick={handleCopyUrl} variant="outline" className="gap-2">
              <LinkIcon className="w-4 h-4" />
              Kopieer link
            </Button>
          </div>

          {isFamilyMember && (
            <div className="mb-6 flex justify-center">
              <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
                <PlusCircle className="w-4 h-4" />
                {showAddForm ? 'Annuleren' : 'Nieuw item toevoegen'}
              </Button>
            </div>
          )}

          <AnimatePresence>
            {showAddForm && (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <Card className="mb-6 bg-white/80 backdrop-blur-sm border-purple-200">
                  <CardContent className="p-6">
                    <form onSubmit={handleAddItem} className="space-y-4">
                      <Input
                        placeholder="Wat wil je graag hebben?"
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        required
                      />
                      <Input
                        placeholder="Link naar product (optioneel)"
                        value={newItem.url}
                        onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Prijs (optioneel - wordt automatisch opgehaald)"
                        value={newItem.price}
                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      />
                      <Button type="submit" disabled={isAdding} className="w-full">
                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                        {isAdding ? 'Toevoegen...' : 'Item toevoegen'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {items.map((item, index) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ delay: index * 0.1 }}>
                  <Card className={`h-full transition-all duration-300 ${item.status === 'claimed' ? 'bg-gray-50 opacity-75' : 'bg-white/80 backdrop-blur-sm hover:shadow-lg'} border-purple-200`}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className={`font-bold text-lg ${item.status === 'claimed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.name}
                        </h3>
                        {isFamilyMember && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-700 h-8 w-8">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {typeof item.price === 'number' && (
                        <p className={`text-2xl font-bold mb-3 ${item.status === 'claimed' ? 'text-gray-400' : 'text-green-600'}`}>
                          €{item.price.toFixed(2)}
                        </p>
                      )}

                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 text-sm mb-4 hover:underline ${item.status === 'claimed' ? 'text-gray-400' : 'text-blue-600'}`}>
                          <LinkIcon className="w-4 h-4" />
                          Bekijk product
                        </a>
                      )}

                      {item.status === 'claimed' ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                            <Check className="w-4 h-4" />
                            <span className="text-sm font-medium">Geclaimd door {item.claimed_by_name}</span>
                          </div>
                          {isFamilyMember && (
                            <Button variant="outline" size="sm" onClick={() => handleUnclaim(item)} className="w-full">
                              Vrijgeven
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Button onClick={() => handleClaim(item)} className="w-full bg-purple-600 hover:bg-purple-700">
                          <Gift className="w-4 h-4 mr-2" />
                          Ik ga dit kopen!
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {items.length === 0 && (
            <div className="text-center py-12">
              <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Nog geen items op de verlanglijst</h3>
              <p className="text-gray-500">
                {isFamilyMember ? 'Voeg je eerste item toe om te beginnen!' : 'Deze verlanglijst is nog leeg.'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

// Remove stray return outside component
};

export default Wishlist;
